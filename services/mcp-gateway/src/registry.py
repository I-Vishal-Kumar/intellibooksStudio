"""
MCP Registry - Service discovery and management for MCP servers.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class MCPServerInfo:
    """Information about a registered MCP server."""

    def __init__(
        self,
        name: str,
        version: str,
        description: str,
        endpoint: str,
        transport: str = "http",
        tools: List[Dict[str, Any]] = None,
        resources: List[Dict[str, Any]] = None,
        metadata: Dict[str, Any] = None,
    ):
        self.name = name
        self.version = version
        self.description = description
        self.endpoint = endpoint
        self.transport = transport
        self.tools = tools or []
        self.resources = resources or []
        self.metadata = metadata or {}
        self.status = "available"
        self.last_health_check = datetime.utcnow()
        self.registered_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "endpoint": self.endpoint,
            "transport": self.transport,
            "tools": self.tools,
            "resources": self.resources,
            "metadata": self.metadata,
            "status": self.status,
            "last_health_check": self.last_health_check.isoformat(),
            "registered_at": self.registered_at.isoformat(),
        }


class MCPRegistry:
    """Central registry for MCP servers."""

    def __init__(self):
        self.servers: Dict[str, MCPServerInfo] = {}
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> Optional[redis.Redis]:
        """Get Redis connection for distributed registry."""
        if self._redis is None:
            redis_url = os.getenv("REDIS_URL")
            if redis_url:
                try:
                    self._redis = redis.from_url(redis_url)
                    await self._redis.ping()
                    logger.info("Connected to Redis for distributed registry")
                except Exception as e:
                    logger.warning(f"Redis not available, using in-memory registry: {e}")
                    self._redis = None
        return self._redis

    async def register(
        self,
        name: str,
        version: str,
        description: str,
        endpoint: str,
        transport: str = "http",
        tools: List[Dict[str, Any]] = None,
        resources: List[Dict[str, Any]] = None,
        metadata: Dict[str, Any] = None,
    ) -> MCPServerInfo:
        """Register a new MCP server."""
        server = MCPServerInfo(
            name=name,
            version=version,
            description=description,
            endpoint=endpoint,
            transport=transport,
            tools=tools,
            resources=resources,
            metadata=metadata,
        )

        self.servers[name] = server

        # Also store in Redis if available
        redis_client = await self._get_redis()
        if redis_client:
            import json
            await redis_client.hset(
                "mcp:servers",
                name,
                json.dumps(server.to_dict()),
            )

        logger.info(f"Registered MCP server: {name} with {len(tools or [])} tools")
        return server

    async def unregister(self, name: str) -> bool:
        """Unregister an MCP server."""
        if name in self.servers:
            del self.servers[name]

            redis_client = await self._get_redis()
            if redis_client:
                await redis_client.hdel("mcp:servers", name)

            logger.info(f"Unregistered MCP server: {name}")
            return True
        return False

    async def get_server(self, name: str) -> Optional[Dict[str, Any]]:
        """Get server information by name."""
        if name in self.servers:
            return self.servers[name].to_dict()
        return None

    async def list_servers(self) -> List[Dict[str, Any]]:
        """List all registered servers."""
        return [server.to_dict() for server in self.servers.values()]

    async def list_all_tools(self) -> List[Dict[str, Any]]:
        """List all tools from all servers."""
        all_tools = []
        for server in self.servers.values():
            for tool in server.tools:
                all_tools.append({
                    "server": server.name,
                    "server_status": server.status,
                    **tool,
                })
        return all_tools

    async def list_all_resources(self) -> List[Dict[str, Any]]:
        """List all resources from all servers."""
        all_resources = []
        for server in self.servers.values():
            for resource in server.resources:
                all_resources.append({
                    "server": server.name,
                    **resource,
                })
        return all_resources

    async def search_tools(
        self, query: str, category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for tools by name or description."""
        query_lower = query.lower()
        results = []

        for server in self.servers.values():
            if category and server.metadata.get("category") != category:
                continue

            for tool in server.tools:
                tool_name = tool.get("name", "").lower()
                tool_desc = tool.get("description", "").lower()

                if query_lower in tool_name or query_lower in tool_desc:
                    results.append({
                        "server": server.name,
                        **tool,
                    })

        return results

    async def find_tool_server(self, tool_name: str) -> Optional[str]:
        """Find which server provides a specific tool."""
        for server in self.servers.values():
            for tool in server.tools:
                if tool.get("name") == tool_name:
                    return server.name
        return None

    async def update_server_status(
        self, name: str, status: str
    ) -> bool:
        """Update the status of a server."""
        if name in self.servers:
            self.servers[name].status = status
            self.servers[name].last_health_check = datetime.utcnow()
            return True
        return False

    async def load_default_servers(self):
        """Load default server configurations from environment."""
        # Default internal services
        default_servers = [
            {
                "name": "database-mcp",
                "version": "1.0.0",
                "description": "Database operations MCP server",
                "endpoint": os.getenv("DATABASE_MCP_URL", "http://localhost:8010"),
                "transport": "http",
                "tools": [
                    {"name": "query_transcripts", "description": "Query transcripts from database"},
                    {"name": "get_transcript", "description": "Get a specific transcript by ID"},
                    {"name": "execute_sql", "description": "Execute read-only SQL query"},
                    {"name": "list_audio_files", "description": "List audio files"},
                ],
                "resources": [
                    {"uri": "db://schemas", "name": "Database Schemas"},
                ],
                "metadata": {"category": "infrastructure"},
            },
            {
                "name": "github-mcp",
                "version": "1.0.0",
                "description": "GitHub integration MCP server",
                "endpoint": os.getenv("GITHUB_MCP_URL", "http://localhost:8011"),
                "transport": "http",
                "tools": [
                    {"name": "create_issue", "description": "Create a GitHub issue"},
                    {"name": "list_issues", "description": "List GitHub issues"},
                    {"name": "list_pull_requests", "description": "List pull requests"},
                    {"name": "search_code", "description": "Search code in repositories"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "slack-mcp",
                "version": "1.0.0",
                "description": "Slack integration MCP server",
                "endpoint": os.getenv("SLACK_MCP_URL", "http://localhost:8012"),
                "transport": "http",
                "tools": [
                    {"name": "send_message", "description": "Send a Slack message"},
                    {"name": "list_channels", "description": "List Slack channels"},
                    {"name": "get_channel_history", "description": "Get channel message history"},
                    {"name": "search_messages", "description": "Search Slack messages"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "teams-mcp",
                "version": "1.0.0",
                "description": "Microsoft Teams integration MCP server",
                "endpoint": os.getenv("TEAMS_MCP_URL", "http://localhost:8013"),
                "transport": "http",
                "tools": [
                    {"name": "send_channel_message", "description": "Send a Teams channel message"},
                    {"name": "list_teams", "description": "List Teams"},
                    {"name": "list_channels", "description": "List channels in a team"},
                    {"name": "get_channel_messages", "description": "Get channel messages"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "gmail-mcp",
                "version": "1.0.0",
                "description": "Gmail integration MCP server",
                "endpoint": os.getenv("GMAIL_MCP_URL", "http://localhost:8014"),
                "transport": "http",
                "tools": [
                    {"name": "list_messages", "description": "List Gmail messages"},
                    {"name": "get_message", "description": "Get a specific email"},
                    {"name": "send_email", "description": "Send an email"},
                    {"name": "search_emails", "description": "Search emails"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "drive-mcp",
                "version": "1.0.0",
                "description": "Google Drive integration MCP server",
                "endpoint": os.getenv("DRIVE_MCP_URL", "http://localhost:8015"),
                "transport": "http",
                "tools": [
                    {"name": "list_files", "description": "List Drive files"},
                    {"name": "get_file", "description": "Get file metadata"},
                    {"name": "download_file", "description": "Download file content"},
                    {"name": "search_files", "description": "Search files"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "clickup-mcp",
                "version": "1.0.0",
                "description": "ClickUp integration MCP server",
                "endpoint": os.getenv("CLICKUP_MCP_URL", "http://localhost:8016"),
                "transport": "http",
                "tools": [
                    {"name": "list_tasks", "description": "List ClickUp tasks"},
                    {"name": "get_task", "description": "Get task details"},
                    {"name": "create_task", "description": "Create a new task"},
                    {"name": "update_task", "description": "Update a task"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "azure-devops-mcp",
                "version": "1.0.0",
                "description": "Azure DevOps integration MCP server",
                "endpoint": os.getenv("AZURE_DEVOPS_MCP_URL", "http://localhost:8017"),
                "transport": "http",
                "tools": [
                    {"name": "list_work_items", "description": "List work items"},
                    {"name": "get_work_item", "description": "Get work item details"},
                    {"name": "list_sprints", "description": "List sprints"},
                    {"name": "get_sprint", "description": "Get sprint details"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "zoom-mcp",
                "version": "1.0.0",
                "description": "Zoom integration MCP server",
                "endpoint": os.getenv("ZOOM_MCP_URL", "http://localhost:8018"),
                "transport": "http",
                "tools": [
                    {"name": "list_meetings", "description": "List Zoom meetings"},
                    {"name": "get_meeting", "description": "Get meeting details"},
                    {"name": "get_recording", "description": "Get meeting recording"},
                    {"name": "get_transcript", "description": "Get meeting transcript"},
                ],
                "metadata": {"category": "integration", "requires_auth": True},
            },
            {
                "name": "neo4j-mcp",
                "version": "1.0.0",
                "description": "Neo4j knowledge graph MCP server",
                "endpoint": os.getenv("NEO4J_MCP_URL", "http://localhost:8019"),
                "transport": "http",
                "tools": [
                    {"name": "query_graph", "description": "Execute Cypher query"},
                    {"name": "find_entities", "description": "Find entities by name"},
                    {"name": "find_paths", "description": "Find paths between entities"},
                    {"name": "add_entity", "description": "Add an entity to the graph"},
                ],
                "metadata": {"category": "infrastructure"},
            },
            {
                "name": "chromadb-mcp",
                "version": "1.0.0",
                "description": "ChromaDB vector search MCP server",
                "endpoint": os.getenv("CHROMADB_MCP_URL", "http://localhost:8020"),
                "transport": "http",
                "tools": [
                    {"name": "search", "description": "Semantic vector search"},
                    {"name": "add_documents", "description": "Add documents to collection"},
                    {"name": "delete_documents", "description": "Delete documents"},
                    {"name": "get_collection_stats", "description": "Get collection statistics"},
                ],
                "metadata": {"category": "infrastructure"},
            },
        ]

        for server_config in default_servers:
            await self.register(**server_config)

        logger.info(f"Loaded {len(default_servers)} default MCP servers")
