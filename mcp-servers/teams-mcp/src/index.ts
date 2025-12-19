/**
 * Microsoft Teams MCP Server
 *
 * Provides Teams operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

// Initialize Microsoft Graph client
const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID || '',
  process.env.AZURE_CLIENT_ID || '',
  process.env.AZURE_CLIENT_SECRET || ''
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ['https://graph.microsoft.com/.default'],
});

const graphClient = Client.initWithMiddleware({
  authProvider,
});

// Tool definitions
const tools = [
  {
    name: 'send_channel_message',
    description: 'Send a message to a Teams channel',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        channelId: { type: 'string', description: 'Channel ID' },
        content: { type: 'string', description: 'Message content (supports HTML)' },
        contentType: { type: 'string', enum: ['text', 'html'], default: 'text' },
      },
      required: ['teamId', 'channelId', 'content'],
    },
  },
  {
    name: 'send_chat_message',
    description: 'Send a message to a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Chat ID' },
        content: { type: 'string', description: 'Message content' },
        contentType: { type: 'string', enum: ['text', 'html'], default: 'text' },
      },
      required: ['chatId', 'content'],
    },
  },
  {
    name: 'list_teams',
    description: 'List all teams the app has access to',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'list_channels',
    description: 'List channels in a team',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'get_channel_messages',
    description: 'Get messages from a channel',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        channelId: { type: 'string', description: 'Channel ID' },
        limit: { type: 'number', default: 20 },
      },
      required: ['teamId', 'channelId'],
    },
  },
  {
    name: 'get_message_replies',
    description: 'Get replies to a channel message',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        channelId: { type: 'string', description: 'Channel ID' },
        messageId: { type: 'string', description: 'Parent message ID' },
      },
      required: ['teamId', 'channelId', 'messageId'],
    },
  },
  {
    name: 'reply_to_message',
    description: 'Reply to a channel message',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        channelId: { type: 'string', description: 'Channel ID' },
        messageId: { type: 'string', description: 'Parent message ID' },
        content: { type: 'string', description: 'Reply content' },
        contentType: { type: 'string', enum: ['text', 'html'], default: 'text' },
      },
      required: ['teamId', 'channelId', 'messageId', 'content'],
    },
  },
  {
    name: 'list_chats',
    description: 'List chats for a user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        limit: { type: 'number', default: 50 },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_chat_messages',
    description: 'Get messages from a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: { type: 'string', description: 'Chat ID' },
        limit: { type: 'number', default: 20 },
      },
      required: ['chatId'],
    },
  },
  {
    name: 'get_user',
    description: 'Get user information',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or email' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'list_team_members',
    description: 'List members of a team',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'create_channel',
    description: 'Create a new channel in a team',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        displayName: { type: 'string', description: 'Channel name' },
        description: { type: 'string', description: 'Channel description' },
        membershipType: { type: 'string', enum: ['standard', 'private'], default: 'standard' },
      },
      required: ['teamId', 'displayName'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'teams-mcp',
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
      case 'send_channel_message': {
        const response = await graphClient
          .api(`/teams/${args?.teamId}/channels/${args?.channelId}/messages`)
          .post({
            body: {
              contentType: args?.contentType || 'text',
              content: args?.content,
            },
          });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.id,
                  createdDateTime: response.createdDateTime,
                  webUrl: response.webUrl,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'send_chat_message': {
        const response = await graphClient.api(`/chats/${args?.chatId}/messages`).post({
          body: {
            contentType: args?.contentType || 'text',
            content: args?.content,
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.id,
                  createdDateTime: response.createdDateTime,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_teams': {
        const response = await graphClient
          .api('/groups')
          .filter("resourceProvisioningOptions/Any(x:x eq 'Team')")
          .top(args?.limit || 50)
          .get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((team: any) => ({
                  id: team.id,
                  displayName: team.displayName,
                  description: team.description,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_channels': {
        const response = await graphClient.api(`/teams/${args?.teamId}/channels`).get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((channel: any) => ({
                  id: channel.id,
                  displayName: channel.displayName,
                  description: channel.description,
                  membershipType: channel.membershipType,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_channel_messages': {
        const response = await graphClient
          .api(`/teams/${args?.teamId}/channels/${args?.channelId}/messages`)
          .top(args?.limit || 20)
          .get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((msg: any) => ({
                  id: msg.id,
                  from: msg.from?.user?.displayName,
                  body: msg.body?.content,
                  createdDateTime: msg.createdDateTime,
                  replyCount: msg.replies?.length || 0,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_message_replies': {
        const response = await graphClient
          .api(
            `/teams/${args?.teamId}/channels/${args?.channelId}/messages/${args?.messageId}/replies`
          )
          .get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((msg: any) => ({
                  id: msg.id,
                  from: msg.from?.user?.displayName,
                  body: msg.body?.content,
                  createdDateTime: msg.createdDateTime,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'reply_to_message': {
        const response = await graphClient
          .api(
            `/teams/${args?.teamId}/channels/${args?.channelId}/messages/${args?.messageId}/replies`
          )
          .post({
            body: {
              contentType: args?.contentType || 'text',
              content: args?.content,
            },
          });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.id,
                  createdDateTime: response.createdDateTime,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_chats': {
        const response = await graphClient
          .api(`/users/${args?.userId}/chats`)
          .top(args?.limit || 50)
          .get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((chat: any) => ({
                  id: chat.id,
                  topic: chat.topic,
                  chatType: chat.chatType,
                  createdDateTime: chat.createdDateTime,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_chat_messages': {
        const response = await graphClient
          .api(`/chats/${args?.chatId}/messages`)
          .top(args?.limit || 20)
          .get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((msg: any) => ({
                  id: msg.id,
                  from: msg.from?.user?.displayName,
                  body: msg.body?.content,
                  createdDateTime: msg.createdDateTime,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_user': {
        const response = await graphClient.api(`/users/${args?.userId}`).get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.id,
                  displayName: response.displayName,
                  mail: response.mail,
                  userPrincipalName: response.userPrincipalName,
                  jobTitle: response.jobTitle,
                  department: response.department,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_team_members': {
        const response = await graphClient.api(`/teams/${args?.teamId}/members`).get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.value.map((member: any) => ({
                  id: member.id,
                  displayName: member.displayName,
                  email: member.email,
                  roles: member.roles,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'create_channel': {
        const response = await graphClient.api(`/teams/${args?.teamId}/channels`).post({
          displayName: args?.displayName,
          description: args?.description,
          membershipType: args?.membershipType || 'standard',
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.id,
                  displayName: response.displayName,
                  webUrl: response.webUrl,
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
  console.error('Teams MCP Server running on stdio');
}

main().catch(console.error);
