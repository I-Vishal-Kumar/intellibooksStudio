/**
 * MCP Registry Server
 *
 * Central registry for discovering and routing to available MCP servers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Registry of available MCP servers
interface MCPServerInfo {
  name: string;
  version: string;
  description: string;
  status: 'available' | 'unavailable' | 'degraded';
  endpoint?: string;
  tools: string[];
  resources: string[];
  lastHealthCheck: Date;
  metadata: Record<string, unknown>;
}

// In-memory registry (in production, this would be backed by a database)
const registry: Map<string, MCPServerInfo> = new Map([
  [
    'database-mcp',
    {
      name: 'database-mcp',
      version: '1.0.0',
      description: 'Database operations MCP server',
      status: 'available',
      endpoint: 'stdio://database-mcp',
      tools: [
        'query_transcripts',
        'get_transcript',
        'get_audio_file',
        'list_audio_files',
        'get_processing_job',
        'execute_sql',
      ],
      resources: ['db://schemas', 'db://audio/tables', 'db://agents/tables', 'db://auth/tables'],
      lastHealthCheck: new Date(),
      metadata: {
        category: 'infrastructure',
        requiresAuth: false,
      },
    },
  ],
  [
    'github-mcp',
    {
      name: 'github-mcp',
      version: '1.0.0',
      description: 'GitHub integration MCP server',
      status: 'available',
      endpoint: 'stdio://github-mcp',
      tools: [
        'create_issue',
        'list_issues',
        'get_issue',
        'add_comment',
        'list_pull_requests',
        'get_pull_request',
        'create_pull_request',
        'get_repo',
        'list_branches',
        'search_code',
      ],
      resources: [],
      lastHealthCheck: new Date(),
      metadata: {
        category: 'integration',
        requiresAuth: true,
        authType: 'token',
      },
    },
  ],
  [
    'slack-mcp',
    {
      name: 'slack-mcp',
      version: '1.0.0',
      description: 'Slack integration MCP server',
      status: 'available',
      endpoint: 'stdio://slack-mcp',
      tools: [
        'send_message',
        'list_channels',
        'get_channel_history',
        'get_thread_replies',
        'search_messages',
        'get_user_info',
        'list_users',
        'add_reaction',
        'upload_file',
        'create_channel',
      ],
      resources: [],
      lastHealthCheck: new Date(),
      metadata: {
        category: 'integration',
        requiresAuth: true,
        authType: 'oauth',
      },
    },
  ],
  [
    'teams-mcp',
    {
      name: 'teams-mcp',
      version: '1.0.0',
      description: 'Microsoft Teams integration MCP server',
      status: 'available',
      endpoint: 'stdio://teams-mcp',
      tools: [
        'send_channel_message',
        'send_chat_message',
        'list_teams',
        'list_channels',
        'get_channel_messages',
        'get_message_replies',
        'reply_to_message',
        'list_chats',
        'get_chat_messages',
        'get_user',
        'list_team_members',
        'create_channel',
      ],
      resources: [],
      lastHealthCheck: new Date(),
      metadata: {
        category: 'integration',
        requiresAuth: true,
        authType: 'oauth',
      },
    },
  ],
]);

// Tool definitions
const tools = [
  {
    name: 'list_servers',
    description: 'List all registered MCP servers',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['available', 'unavailable', 'degraded', 'all'], default: 'all' },
        category: { type: 'string', description: 'Filter by category' },
      },
    },
  },
  {
    name: 'get_server',
    description: 'Get information about a specific MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Server name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'register_server',
    description: 'Register a new MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Server name' },
        version: { type: 'string', description: 'Server version' },
        description: { type: 'string', description: 'Server description' },
        endpoint: { type: 'string', description: 'Server endpoint' },
        tools: { type: 'array', items: { type: 'string' }, description: 'Available tools' },
        resources: { type: 'array', items: { type: 'string' }, description: 'Available resources' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['name', 'version', 'description'],
    },
  },
  {
    name: 'unregister_server',
    description: 'Unregister an MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Server name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_server_status',
    description: 'Update the status of an MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Server name' },
        status: { type: 'string', enum: ['available', 'unavailable', 'degraded'] },
      },
      required: ['name', 'status'],
    },
  },
  {
    name: 'search_tools',
    description: 'Search for tools across all MCP servers',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Filter by category' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_server_for_tool',
    description: 'Find which server provides a specific tool',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Tool name' },
      },
      required: ['tool'],
    },
  },
];

// Resources
const resources = [
  {
    uri: 'registry://servers',
    name: 'All Servers',
    description: 'List of all registered MCP servers',
    mimeType: 'application/json',
  },
  {
    uri: 'registry://tools',
    name: 'All Tools',
    description: 'List of all available tools across servers',
    mimeType: 'application/json',
  },
  {
    uri: 'registry://stats',
    name: 'Registry Statistics',
    description: 'Statistics about the MCP registry',
    mimeType: 'application/json',
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'mcp-registry',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_servers': {
        let servers = Array.from(registry.values());

        if (args?.status && args.status !== 'all') {
          servers = servers.filter((s) => s.status === args.status);
        }

        if (args?.category) {
          servers = servers.filter((s) => s.metadata.category === args.category);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                servers.map((s) => ({
                  name: s.name,
                  version: s.version,
                  description: s.description,
                  status: s.status,
                  toolCount: s.tools.length,
                  resourceCount: s.resources.length,
                  category: s.metadata.category,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_server': {
        const serverInfo = registry.get(args?.name as string);

        if (!serverInfo) {
          return {
            content: [{ type: 'text', text: `Server not found: ${args?.name}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serverInfo, null, 2),
            },
          ],
        };
      }

      case 'register_server': {
        const newServer: MCPServerInfo = {
          name: args?.name as string,
          version: args?.version as string,
          description: args?.description as string,
          status: 'available',
          endpoint: args?.endpoint as string,
          tools: (args?.tools as string[]) || [],
          resources: (args?.resources as string[]) || [],
          lastHealthCheck: new Date(),
          metadata: (args?.metadata as Record<string, unknown>) || {},
        };

        registry.set(newServer.name, newServer);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ registered: true, server: newServer }, null, 2),
            },
          ],
        };
      }

      case 'unregister_server': {
        const deleted = registry.delete(args?.name as string);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ unregistered: deleted, name: args?.name }, null, 2),
            },
          ],
        };
      }

      case 'update_server_status': {
        const serverToUpdate = registry.get(args?.name as string);

        if (!serverToUpdate) {
          return {
            content: [{ type: 'text', text: `Server not found: ${args?.name}` }],
            isError: true,
          };
        }

        serverToUpdate.status = args?.status as 'available' | 'unavailable' | 'degraded';
        serverToUpdate.lastHealthCheck = new Date();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ updated: true, server: serverToUpdate }, null, 2),
            },
          ],
        };
      }

      case 'search_tools': {
        const query = (args?.query as string).toLowerCase();
        const results: Array<{ server: string; tool: string }> = [];

        for (const [serverName, serverInfo] of registry) {
          if (args?.category && serverInfo.metadata.category !== args.category) {
            continue;
          }

          for (const tool of serverInfo.tools) {
            if (tool.toLowerCase().includes(query)) {
              results.push({ server: serverName, tool });
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_server_for_tool': {
        const toolName = args?.tool as string;

        for (const [serverName, serverInfo] of registry) {
          if (serverInfo.tools.includes(toolName)) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      server: serverName,
                      endpoint: serverInfo.endpoint,
                      status: serverInfo.status,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        return {
          content: [{ type: 'text', text: `Tool not found: ${toolName}` }],
          isError: true,
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
});

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'registry://servers': {
        const servers = Array.from(registry.values());

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(servers, null, 2),
            },
          ],
        };
      }

      case 'registry://tools': {
        const allTools: Array<{ server: string; tool: string; status: string }> = [];

        for (const [serverName, serverInfo] of registry) {
          for (const tool of serverInfo.tools) {
            allTools.push({
              server: serverName,
              tool,
              status: serverInfo.status,
            });
          }
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(allTools, null, 2),
            },
          ],
        };
      }

      case 'registry://stats': {
        const servers = Array.from(registry.values());

        const stats = {
          totalServers: servers.length,
          availableServers: servers.filter((s) => s.status === 'available').length,
          unavailableServers: servers.filter((s) => s.status === 'unavailable').length,
          degradedServers: servers.filter((s) => s.status === 'degraded').length,
          totalTools: servers.reduce((sum, s) => sum + s.tools.length, 0),
          totalResources: servers.reduce((sum, s) => sum + s.resources.length, 0),
          byCategory: servers.reduce(
            (acc, s) => {
              const category = (s.metadata.category as string) || 'uncategorized';
              acc[category] = (acc[category] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
        };

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Registry Server running on stdio');
}

main().catch(console.error);
