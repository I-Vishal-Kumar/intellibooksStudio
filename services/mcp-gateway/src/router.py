"""
MCP Router - Routes MCP calls to appropriate servers.
"""

import logging
from typing import Any, Dict, List, Optional

import httpx

from .registry import MCPRegistry

logger = logging.getLogger(__name__)


class MCPRouter:
    """Routes MCP calls to registered servers."""

    def __init__(self, registry: MCPRegistry):
        self.registry = registry
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self):
        """Close the HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def call_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Any:
        """Call a tool on a specific MCP server."""
        server = self.registry.servers.get(server_name)
        if not server:
            raise ValueError(f"Server not found: {server_name}")

        if server.status != "available":
            raise ValueError(f"Server {server_name} is not available (status: {server.status})")

        client = await self._get_client()

        # Build MCP request
        mcp_request = {
            "jsonrpc": "2.0",
            "id": trace_id or "1",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
        }

        # Add session context if provided
        if session_id:
            mcp_request["params"]["_meta"] = {"session_id": session_id}

        try:
            if server.transport == "http":
                response = await client.post(
                    f"{server.endpoint}/mcp",
                    json=mcp_request,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                result = response.json()

                if "error" in result:
                    raise ValueError(result["error"].get("message", "Unknown error"))

                return result.get("result", {}).get("content", [])

            else:
                raise ValueError(f"Unsupported transport: {server.transport}")

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error calling {server_name}/{tool_name}: {e}")
            await self.registry.update_server_status(server_name, "degraded")
            raise
        except httpx.ConnectError as e:
            logger.error(f"Connection error to {server_name}: {e}")
            await self.registry.update_server_status(server_name, "unavailable")
            raise
        except Exception as e:
            logger.error(f"Error calling {server_name}/{tool_name}: {e}")
            raise

    async def read_resource(
        self,
        server_name: str,
        uri: str,
        session_id: Optional[str] = None,
    ) -> Any:
        """Read a resource from an MCP server."""
        server = self.registry.servers.get(server_name)
        if not server:
            raise ValueError(f"Server not found: {server_name}")

        client = await self._get_client()

        mcp_request = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "resources/read",
            "params": {
                "uri": uri,
            },
        }

        try:
            if server.transport == "http":
                response = await client.post(
                    f"{server.endpoint}/mcp",
                    json=mcp_request,
                )
                response.raise_for_status()
                result = response.json()

                if "error" in result:
                    raise ValueError(result["error"].get("message", "Unknown error"))

                return result.get("result", {}).get("contents", [])

            else:
                raise ValueError(f"Unsupported transport: {server.transport}")

        except Exception as e:
            logger.error(f"Error reading resource {uri} from {server_name}: {e}")
            raise

    async def list_tools(self, server_name: str) -> List[Dict[str, Any]]:
        """List all tools from a specific server."""
        server = self.registry.servers.get(server_name)
        if not server:
            raise ValueError(f"Server not found: {server_name}")

        client = await self._get_client()

        mcp_request = {
            "jsonrpc": "2.0",
            "id": "1",
            "method": "tools/list",
            "params": {},
        }

        try:
            if server.transport == "http":
                response = await client.post(
                    f"{server.endpoint}/mcp",
                    json=mcp_request,
                )
                response.raise_for_status()
                result = response.json()

                return result.get("result", {}).get("tools", [])

            else:
                raise ValueError(f"Unsupported transport: {server.transport}")

        except Exception as e:
            logger.error(f"Error listing tools from {server_name}: {e}")
            raise

    async def check_server_health(self, server_name: str) -> Dict[str, Any]:
        """Check health of a specific server."""
        server = self.registry.servers.get(server_name)
        if not server:
            return {"name": server_name, "status": "not_found"}

        client = await self._get_client()

        try:
            if server.transport == "http":
                response = await client.get(
                    f"{server.endpoint}/health",
                    timeout=5.0,
                )

                if response.status_code == 200:
                    await self.registry.update_server_status(server_name, "available")
                    return {
                        "name": server_name,
                        "status": "available",
                        "response_time_ms": response.elapsed.total_seconds() * 1000,
                    }
                else:
                    await self.registry.update_server_status(server_name, "degraded")
                    return {
                        "name": server_name,
                        "status": "degraded",
                        "status_code": response.status_code,
                    }

            else:
                return {"name": server_name, "status": "unknown", "transport": server.transport}

        except httpx.ConnectError:
            await self.registry.update_server_status(server_name, "unavailable")
            return {"name": server_name, "status": "unavailable", "error": "Connection refused"}
        except httpx.TimeoutException:
            await self.registry.update_server_status(server_name, "degraded")
            return {"name": server_name, "status": "degraded", "error": "Timeout"}
        except Exception as e:
            await self.registry.update_server_status(server_name, "unavailable")
            return {"name": server_name, "status": "unavailable", "error": str(e)}

    async def check_all_health(self) -> List[Dict[str, Any]]:
        """Check health of all registered servers."""
        import asyncio

        tasks = [
            self.check_server_health(name)
            for name in self.registry.servers.keys()
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return [
            r if isinstance(r, dict) else {"error": str(r)}
            for r in results
        ]
