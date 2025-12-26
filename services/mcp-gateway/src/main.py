"""
MCP Gateway Service

Central router for all MCP communications. Routes MCP calls to appropriate
servers, handles service discovery, and provides a unified API for clients.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .registry import MCPRegistry
from .router import MCPRouter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MCP Gateway",
    description="Central router for Model Context Protocol communications",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
registry = MCPRegistry()
router = MCPRouter(registry)


# Request/Response Models
class MCPToolCall(BaseModel):
    """MCP tool call request."""
    server: Optional[str] = None  # If None, auto-discover from tool name
    tool: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    trace_id: Optional[str] = None


class MCPResourceRead(BaseModel):
    """MCP resource read request."""
    server: str
    uri: str
    session_id: Optional[str] = None


class MCPBatchRequest(BaseModel):
    """Batch MCP requests for parallel execution."""
    requests: List[MCPToolCall]
    parallel: bool = True


class MCPResponse(BaseModel):
    """Standard MCP response."""
    id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    server: Optional[str] = None
    execution_time_ms: Optional[float] = None


class ServerRegistration(BaseModel):
    """Server registration request."""
    name: str
    version: str
    description: str
    endpoint: str
    transport: str = "http"  # http, stdio, websocket
    tools: List[Dict[str, Any]] = Field(default_factory=list)
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "mcp-gateway",
        "timestamp": datetime.utcnow().isoformat(),
        "registered_servers": len(registry.servers),
    }


# Server Registration
@app.post("/api/mcp/servers/register")
async def register_server(registration: ServerRegistration):
    """Register a new MCP server."""
    try:
        await registry.register(
            name=registration.name,
            version=registration.version,
            description=registration.description,
            endpoint=registration.endpoint,
            transport=registration.transport,
            tools=registration.tools,
            resources=registration.resources,
            metadata=registration.metadata,
        )
        logger.info(f"Registered MCP server: {registration.name}")
        return {"success": True, "message": f"Server {registration.name} registered"}
    except Exception as e:
        logger.error(f"Failed to register server: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/mcp/servers/{server_name}")
async def unregister_server(server_name: str):
    """Unregister an MCP server."""
    success = await registry.unregister(server_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Server {server_name} not found")
    return {"success": True, "message": f"Server {server_name} unregistered"}


@app.get("/api/mcp/servers")
async def list_servers():
    """List all registered MCP servers."""
    servers = await registry.list_servers()
    return {"servers": servers}


@app.get("/api/mcp/servers/{server_name}")
async def get_server(server_name: str):
    """Get details of a specific MCP server."""
    server = await registry.get_server(server_name)
    if not server:
        raise HTTPException(status_code=404, detail=f"Server {server_name} not found")
    return server


# Tool Discovery
@app.get("/api/mcp/tools")
async def list_all_tools():
    """List all available tools across all servers."""
    tools = await registry.list_all_tools()
    return {"tools": tools}


@app.get("/api/mcp/tools/search")
async def search_tools(query: str, category: Optional[str] = None):
    """Search for tools by name or description."""
    tools = await registry.search_tools(query, category)
    return {"tools": tools}


@app.get("/api/mcp/tools/{tool_name}/server")
async def find_tool_server(tool_name: str):
    """Find which server provides a specific tool."""
    server = await registry.find_tool_server(tool_name)
    if not server:
        raise HTTPException(status_code=404, detail=f"Tool {tool_name} not found")
    return {"tool": tool_name, "server": server}


# Tool Execution
@app.post("/api/mcp/call", response_model=MCPResponse)
async def call_tool(request: MCPToolCall):
    """Call an MCP tool on any registered server."""
    request_id = request.trace_id or str(uuid4())
    start_time = datetime.utcnow()

    try:
        # Auto-discover server if not specified
        server_name = request.server
        if not server_name:
            server_name = await registry.find_tool_server(request.tool)
            if not server_name:
                return MCPResponse(
                    id=request_id,
                    success=False,
                    error=f"Tool '{request.tool}' not found on any registered server",
                )

        # Execute the tool call
        result = await router.call_tool(
            server_name=server_name,
            tool_name=request.tool,
            arguments=request.arguments,
            session_id=request.session_id,
            trace_id=request_id,
        )

        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return MCPResponse(
            id=request_id,
            success=True,
            result=result,
            server=server_name,
            execution_time_ms=execution_time,
        )

    except Exception as e:
        logger.error(f"Tool call failed: {e}")
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        return MCPResponse(
            id=request_id,
            success=False,
            error=str(e),
            execution_time_ms=execution_time,
        )


@app.post("/api/mcp/batch")
async def batch_call(request: MCPBatchRequest):
    """Execute multiple MCP tool calls, optionally in parallel."""
    results = []

    if request.parallel:
        # Execute all requests in parallel
        tasks = [call_tool(req) for req in request.requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        # Convert exceptions to error responses
        results = [
            r if isinstance(r, MCPResponse)
            else MCPResponse(id=str(uuid4()), success=False, error=str(r))
            for r in results
        ]
    else:
        # Execute sequentially
        for req in request.requests:
            result = await call_tool(req)
            results.append(result)

    return {"results": results}


# Resource Access
@app.post("/api/mcp/resource")
async def read_resource(request: MCPResourceRead):
    """Read a resource from an MCP server."""
    request_id = str(uuid4())

    try:
        result = await router.read_resource(
            server_name=request.server,
            uri=request.uri,
            session_id=request.session_id,
        )

        return MCPResponse(
            id=request_id,
            success=True,
            result=result,
            server=request.server,
        )

    except Exception as e:
        logger.error(f"Resource read failed: {e}")
        return MCPResponse(
            id=request_id,
            success=False,
            error=str(e),
        )


@app.get("/api/mcp/resources")
async def list_all_resources():
    """List all available resources across all servers."""
    resources = await registry.list_all_resources()
    return {"resources": resources}


# Health Monitoring
@app.get("/api/mcp/health")
async def check_all_health():
    """Check health of all registered MCP servers."""
    health_status = await router.check_all_health()
    return {"servers": health_status}


@app.get("/api/mcp/servers/{server_name}/health")
async def check_server_health(server_name: str):
    """Check health of a specific MCP server."""
    status = await router.check_server_health(server_name)
    return status


# WebSocket for real-time MCP streaming
@app.websocket("/ws/mcp")
async def mcp_websocket(websocket: WebSocket):
    """WebSocket endpoint for streaming MCP communications."""
    await websocket.accept()
    session_id = str(uuid4())
    logger.info(f"WebSocket connection established: {session_id}")

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "tool_call":
                request = MCPToolCall(**data.get("payload", {}))
                result = await call_tool(request)
                await websocket.send_json({
                    "type": "tool_result",
                    "payload": result.model_dump(),
                })

            elif data.get("type") == "subscribe":
                # Subscribe to server events
                server_name = data.get("server")
                await websocket.send_json({
                    "type": "subscribed",
                    "server": server_name,
                })

            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011)


# Startup event
@app.on_event("startup")
async def startup():
    """Initialize the gateway on startup."""
    logger.info("MCP Gateway starting up...")

    # Register default servers from environment
    await registry.load_default_servers()

    logger.info(f"MCP Gateway ready with {len(registry.servers)} servers")


# Shutdown event
@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("MCP Gateway shutting down...")
    await router.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8005)))
