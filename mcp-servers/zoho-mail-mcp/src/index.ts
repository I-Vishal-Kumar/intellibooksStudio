/**
 * Zoho Mail MCP Server
 *
 * Provides Zoho Mail operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ZOHO_API_URL = 'https://mail.zoho.com/api';
const ZOHO_ACCESS_TOKEN = process.env.ZOHO_MAIL_ACCESS_TOKEN;
const ZOHO_ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID;

async function zohoFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${ZOHO_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoho Mail API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool definitions
const tools = [
  {
    name: 'list_messages',
    description: 'List emails from Zoho Mail',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', description: 'Folder ID (use "inbox" for inbox)' },
        limit: { type: 'number', default: 20 },
        start: { type: 'number', default: 1 },
        searchKey: { type: 'string', description: 'Search within emails' },
      },
    },
  },
  {
    name: 'get_message',
    description: 'Get a specific email by ID',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        folderId: { type: 'string', description: 'Folder ID' },
      },
      required: ['messageId', 'folderId'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient emails' },
        subject: { type: 'string', description: 'Email subject' },
        content: { type: 'string', description: 'Email body (HTML supported)' },
        cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
        bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
      },
      required: ['to', 'subject', 'content'],
    },
  },
  {
    name: 'search_emails',
    description: 'Search emails',
    inputSchema: {
      type: 'object',
      properties: {
        searchKey: { type: 'string', description: 'Search query' },
        limit: { type: 'number', default: 20 },
      },
      required: ['searchKey'],
    },
  },
  {
    name: 'list_folders',
    description: 'List all mail folders',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'move_message',
    description: 'Move a message to another folder',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        fromFolderId: { type: 'string', description: 'Source folder ID' },
        toFolderId: { type: 'string', description: 'Destination folder ID' },
      },
      required: ['messageId', 'fromFolderId', 'toFolderId'],
    },
  },
  {
    name: 'delete_message',
    description: 'Move a message to trash',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        folderId: { type: 'string', description: 'Current folder ID' },
      },
      required: ['messageId', 'folderId'],
    },
  },
  {
    name: 'mark_as_read',
    description: 'Mark a message as read/unread',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        folderId: { type: 'string', description: 'Folder ID' },
        isRead: { type: 'boolean', description: 'Mark as read (true) or unread (false)' },
      },
      required: ['messageId', 'folderId', 'isRead'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'zoho-mail-mcp',
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
      case 'list_messages': {
        const folderId = (args?.folderId as string) || 'inbox';
        const params = new URLSearchParams({
          limit: String(args?.limit || 20),
          start: String(args?.start || 1),
        });
        if (args?.searchKey) {
          params.append('searchKey', args.searchKey as string);
        }

        const result = await zohoFetch(`/accounts/${ZOHO_ACCOUNT_ID}/messages/view?${params}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'get_message': {
        const result = await zohoFetch(
          `/accounts/${ZOHO_ACCOUNT_ID}/folders/${args?.folderId}/messages/${args?.messageId}`
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'send_email': {
        const toAddresses = (args?.to as string[]).map(email => ({ address: email }));
        const ccAddresses = (args?.cc as string[] || []).map(email => ({ address: email }));
        const bccAddresses = (args?.bcc as string[] || []).map(email => ({ address: email }));

        const result = await zohoFetch(`/accounts/${ZOHO_ACCOUNT_ID}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            toAddress: toAddresses,
            ccAddress: ccAddresses,
            bccAddress: bccAddresses,
            subject: args?.subject,
            content: args?.content,
          }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'search_emails': {
        const result = await zohoFetch(
          `/accounts/${ZOHO_ACCOUNT_ID}/messages/search?searchKey=${encodeURIComponent(args?.searchKey as string)}&limit=${args?.limit || 20}`
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'list_folders': {
        const result = await zohoFetch(`/accounts/${ZOHO_ACCOUNT_ID}/folders`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
        };
      }

      case 'move_message': {
        const result = await zohoFetch(
          `/accounts/${ZOHO_ACCOUNT_ID}/folders/${args?.fromFolderId}/messages/${args?.messageId}/move`,
          {
            method: 'PUT',
            body: JSON.stringify({ destfolderId: args?.toFolderId }),
          }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, ...result }, null, 2) }],
        };
      }

      case 'delete_message': {
        const result = await zohoFetch(
          `/accounts/${ZOHO_ACCOUNT_ID}/folders/${args?.folderId}/messages/${args?.messageId}/trash`,
          { method: 'PUT' }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'mark_as_read': {
        const result = await zohoFetch(
          `/accounts/${ZOHO_ACCOUNT_ID}/folders/${args?.folderId}/messages/${args?.messageId}`,
          {
            method: 'PUT',
            body: JSON.stringify({ mode: args?.isRead ? 'markAsRead' : 'markAsUnread' }),
          }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
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
  console.error('Zoho Mail MCP Server running on stdio');
}

main().catch(console.error);
