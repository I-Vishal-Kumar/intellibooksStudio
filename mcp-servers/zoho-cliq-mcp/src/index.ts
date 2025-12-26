/**
 * Zoho Cliq MCP Server
 *
 * Provides Zoho Cliq chat operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ZOHO_CLIQ_API_URL = 'https://cliq.zoho.com/api/v2';
const ZOHO_ACCESS_TOKEN = process.env.ZOHO_CLIQ_ACCESS_TOKEN;

async function cliqFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${ZOHO_CLIQ_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoho Cliq API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool definitions
const tools = [
  {
    name: 'send_message',
    description: 'Send a message to a channel or user',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Channel unique name or ID' },
        text: { type: 'string', description: 'Message text' },
        bot: { type: 'string', description: 'Bot unique name (optional)' },
      },
      required: ['channelId', 'text'],
    },
  },
  {
    name: 'list_channels',
    description: 'List all channels',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'get_messages',
    description: 'Get messages from a channel',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Channel ID' },
        limit: { type: 'number', default: 50 },
        fromTime: { type: 'number', description: 'Start time (Unix timestamp ms)' },
        toTime: { type: 'number', description: 'End time (Unix timestamp ms)' },
      },
      required: ['channelId'],
    },
  },
  {
    name: 'search_messages',
    description: 'Search messages across channels',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        channelId: { type: 'string', description: 'Filter by channel (optional)' },
        limit: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_channel_info',
    description: 'Get channel details',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Channel ID' },
      },
      required: ['channelId'],
    },
  },
  {
    name: 'create_channel',
    description: 'Create a new channel',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Channel name' },
        description: { type: 'string', description: 'Channel description' },
        members: { type: 'array', items: { type: 'string' }, description: 'Member email addresses' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_channel_members',
    description: 'Add members to a channel',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Channel ID' },
        members: { type: 'array', items: { type: 'string' }, description: 'Member email addresses' },
      },
      required: ['channelId', 'members'],
    },
  },
  {
    name: 'list_users',
    description: 'List all users in the organization',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'get_user_info',
    description: 'Get user details',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or email' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'send_direct_message',
    description: 'Send a direct message to a user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or email' },
        text: { type: 'string', description: 'Message text' },
      },
      required: ['userId', 'text'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'zoho-cliq-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
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
      case 'send_message': {
        const result = await cliqFetch(`/channels/${args?.channelId}/message`, {
          method: 'POST',
          body: JSON.stringify({
            text: args?.text,
            bot: args?.bot,
          }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_channels': {
        const result = await cliqFetch(`/channels?limit=${args?.limit || 50}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'get_messages': {
        const params = new URLSearchParams({
          limit: String(args?.limit || 50),
        });
        if (args?.fromTime) params.append('from_time', String(args.fromTime));
        if (args?.toTime) params.append('to_time', String(args.toTime));

        const result = await cliqFetch(`/channels/${args?.channelId}/messages?${params}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'search_messages': {
        const params = new URLSearchParams({
          query: args?.query as string,
          limit: String(args?.limit || 20),
        });
        if (args?.channelId) params.append('channel_id', args.channelId as string);

        const result = await cliqFetch(`/search/messages?${params}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'get_channel_info': {
        const result = await cliqFetch(`/channels/${args?.channelId}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'create_channel': {
        const result = await cliqFetch('/channels', {
          method: 'POST',
          body: JSON.stringify({
            name: args?.name,
            description: args?.description,
            members: args?.members,
          }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'add_channel_members': {
        const result = await cliqFetch(`/channels/${args?.channelId}/members`, {
          method: 'POST',
          body: JSON.stringify({
            members: args?.members,
          }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_users': {
        const result = await cliqFetch(`/users?limit=${args?.limit || 50}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'get_user_info': {
        const result = await cliqFetch(`/users/${encodeURIComponent(args?.userId as string)}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'send_direct_message': {
        const result = await cliqFetch(`/buddies/${encodeURIComponent(args?.userId as string)}/message`, {
          method: 'POST',
          body: JSON.stringify({
            text: args?.text,
          }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Zoho Cliq MCP Server running on stdio');
}

main().catch(console.error);
