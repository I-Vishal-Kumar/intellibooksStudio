/**
 * Slack MCP Server
 *
 * Provides Slack operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebClient } from '@slack/web-api';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Tool definitions
const tools = [
  {
    name: 'send_message',
    description: 'Send a message to a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel ID or name' },
        text: { type: 'string', description: 'Message text' },
        thread_ts: { type: 'string', description: 'Thread timestamp for replies' },
        blocks: { type: 'array', description: 'Block kit blocks' },
      },
      required: ['channel', 'text'],
    },
  },
  {
    name: 'list_channels',
    description: 'List Slack channels',
    inputSchema: {
      type: 'object',
      properties: {
        types: { type: 'string', default: 'public_channel,private_channel', description: 'Channel types' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'get_channel_history',
    description: 'Get message history from a channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel ID' },
        limit: { type: 'number', default: 20 },
        oldest: { type: 'string', description: 'Start of time range (timestamp)' },
        latest: { type: 'string', description: 'End of time range (timestamp)' },
      },
      required: ['channel'],
    },
  },
  {
    name: 'get_thread_replies',
    description: 'Get replies to a thread',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel ID' },
        ts: { type: 'string', description: 'Thread parent timestamp' },
        limit: { type: 'number', default: 20 },
      },
      required: ['channel', 'ts'],
    },
  },
  {
    name: 'search_messages',
    description: 'Search for messages',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', default: 20 },
        sort: { type: 'string', enum: ['score', 'timestamp'], default: 'timestamp' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user_info',
    description: 'Get information about a user',
    inputSchema: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'User ID' },
      },
      required: ['user'],
    },
  },
  {
    name: 'list_users',
    description: 'List workspace users',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'add_reaction',
    description: 'Add a reaction to a message',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel ID' },
        timestamp: { type: 'string', description: 'Message timestamp' },
        name: { type: 'string', description: 'Emoji name (without colons)' },
      },
      required: ['channel', 'timestamp', 'name'],
    },
  },
  {
    name: 'upload_file',
    description: 'Upload a file to Slack',
    inputSchema: {
      type: 'object',
      properties: {
        channels: { type: 'string', description: 'Comma-separated channel IDs' },
        content: { type: 'string', description: 'File content' },
        filename: { type: 'string', description: 'Filename' },
        filetype: { type: 'string', description: 'File type' },
        title: { type: 'string', description: 'File title' },
        initial_comment: { type: 'string', description: 'Initial comment' },
      },
      required: ['channels', 'content', 'filename'],
    },
  },
  {
    name: 'create_channel',
    description: 'Create a new channel',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Channel name' },
        is_private: { type: 'boolean', default: false },
      },
      required: ['name'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'slack-mcp',
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
        const response = await slack.chat.postMessage({
          channel: args?.channel as string,
          text: args?.text as string,
          thread_ts: args?.thread_ts as string,
          blocks: args?.blocks as any[],
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: response.ok,
                  channel: response.channel,
                  ts: response.ts,
                  message: response.message,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_channels': {
        const response = await slack.conversations.list({
          types: (args?.types as string) || 'public_channel,private_channel',
          limit: (args?.limit as number) || 100,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.channels?.map((ch) => ({
                  id: ch.id,
                  name: ch.name,
                  is_private: ch.is_private,
                  num_members: ch.num_members,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_channel_history': {
        const response = await slack.conversations.history({
          channel: args?.channel as string,
          limit: (args?.limit as number) || 20,
          oldest: args?.oldest as string,
          latest: args?.latest as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.messages?.map((msg) => ({
                  user: msg.user,
                  text: msg.text,
                  ts: msg.ts,
                  type: msg.type,
                  reply_count: msg.reply_count,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_thread_replies': {
        const response = await slack.conversations.replies({
          channel: args?.channel as string,
          ts: args?.ts as string,
          limit: (args?.limit as number) || 20,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.messages?.map((msg) => ({
                  user: msg.user,
                  text: msg.text,
                  ts: msg.ts,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_messages': {
        const response = await slack.search.messages({
          query: args?.query as string,
          count: (args?.count as number) || 20,
          sort: (args?.sort as 'score' | 'timestamp') || 'timestamp',
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: response.messages?.total,
                  matches: response.messages?.matches?.map((match) => ({
                    channel: match.channel?.name,
                    user: match.user,
                    text: match.text,
                    ts: match.ts,
                    permalink: match.permalink,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_user_info': {
        const response = await slack.users.info({
          user: args?.user as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.user?.id,
                  name: response.user?.name,
                  real_name: response.user?.real_name,
                  email: response.user?.profile?.email,
                  is_admin: response.user?.is_admin,
                  is_bot: response.user?.is_bot,
                  tz: response.user?.tz,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_users': {
        const response = await slack.users.list({
          limit: (args?.limit as number) || 100,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.members
                  ?.filter((m) => !m.deleted && !m.is_bot)
                  .map((m) => ({
                    id: m.id,
                    name: m.name,
                    real_name: m.real_name,
                    is_admin: m.is_admin,
                  })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'add_reaction': {
        const response = await slack.reactions.add({
          channel: args?.channel as string,
          timestamp: args?.timestamp as string,
          name: args?.name as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: response.ok }, null, 2),
            },
          ],
        };
      }

      case 'upload_file': {
        const response = await slack.files.upload({
          channels: args?.channels as string,
          content: args?.content as string,
          filename: args?.filename as string,
          filetype: args?.filetype as string,
          title: args?.title as string,
          initial_comment: args?.initial_comment as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: response.ok,
                  file: {
                    id: response.file?.id,
                    name: response.file?.name,
                    permalink: response.file?.permalink,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'create_channel': {
        const response = await slack.conversations.create({
          name: args?.name as string,
          is_private: args?.is_private as boolean,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: response.ok,
                  channel: {
                    id: response.channel?.id,
                    name: response.channel?.name,
                  },
                },
                null,
                2
              ),
            },
          ],
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
  console.error('Slack MCP Server running on stdio');
}

main().catch(console.error);
