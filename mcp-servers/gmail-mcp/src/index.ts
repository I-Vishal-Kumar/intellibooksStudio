/**
 * Gmail MCP Server
 *
 * Provides Gmail operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials if available
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Tool definitions
const tools = [
  {
    name: 'list_messages',
    description: 'List Gmail messages with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g., "is:unread", "from:user@example.com")' },
        maxResults: { type: 'number', default: 20, description: 'Maximum number of messages to return' },
        labelIds: { type: 'array', items: { type: 'string' }, description: 'Filter by label IDs' },
      },
    },
  },
  {
    name: 'get_message',
    description: 'Get a specific email message by ID',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        format: { type: 'string', enum: ['full', 'metadata', 'minimal'], default: 'full' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (HTML supported)' },
        cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
        bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'search_emails',
    description: 'Search emails using Gmail query syntax',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query' },
        maxResults: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_labels',
    description: 'Get all Gmail labels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'modify_labels',
    description: 'Add or remove labels from a message',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
        addLabelIds: { type: 'array', items: { type: 'string' } },
        removeLabelIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'trash_message',
    description: 'Move a message to trash',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Message ID' },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'get_thread',
    description: 'Get a complete email thread',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Thread ID' },
      },
      required: ['threadId'],
    },
  },
];

// Helper functions
function parseEmailHeaders(headers: { name: string; value: string }[]) {
  const result: Record<string, string> = {};
  for (const header of headers) {
    result[header.name.toLowerCase()] = header.value;
  }
  return result;
}

function createRawEmail(to: string[], subject: string, body: string, cc?: string[], bcc?: string[]) {
  const headers = [
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  if (cc?.length) headers.push(`Cc: ${cc.join(', ')}`);
  if (bcc?.length) headers.push(`Bcc: ${bcc.join(', ')}`);

  const email = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(email).toString('base64url');
}

// Create MCP Server
const server = new Server(
  {
    name: 'gmail-mcp',
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
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: args?.query as string,
          maxResults: (args?.maxResults as number) || 20,
          labelIds: args?.labelIds as string[],
        });

        const messages = [];
        for (const msg of response.data.messages || []) {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const headers = parseEmailHeaders(detail.data.payload?.headers || []);

          messages.push({
            id: msg.id,
            threadId: msg.threadId,
            subject: headers['subject'] || 'No Subject',
            from: headers['from'] || 'Unknown',
            to: headers['to'] || '',
            date: headers['date'] || '',
            snippet: detail.data.snippet,
            labelIds: detail.data.labelIds,
          });
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      }

      case 'get_message': {
        const response = await gmail.users.messages.get({
          userId: 'me',
          id: args?.messageId as string,
          format: (args?.format as 'full' | 'metadata' | 'minimal') || 'full',
        });

        const headers = parseEmailHeaders(response.data.payload?.headers || []);

        // Decode body if available
        let body = '';
        if (response.data.payload?.body?.data) {
          body = Buffer.from(response.data.payload.body.data, 'base64url').toString();
        } else if (response.data.payload?.parts) {
          for (const part of response.data.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64url').toString();
              break;
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.data.id,
                  threadId: response.data.threadId,
                  subject: headers['subject'],
                  from: headers['from'],
                  to: headers['to'],
                  date: headers['date'],
                  body,
                  labelIds: response.data.labelIds,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'send_email': {
        const raw = createRawEmail(
          args?.to as string[],
          args?.subject as string,
          args?.body as string,
          args?.cc as string[],
          args?.bcc as string[]
        );

        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, messageId: response.data.id }, null, 2),
            },
          ],
        };
      }

      case 'search_emails': {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: args?.query as string,
          maxResults: (args?.maxResults as number) || 20,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  resultCount: response.data.messages?.length || 0,
                  messages: response.data.messages,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_labels': {
        const response = await gmail.users.labels.list({ userId: 'me' });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.labels, null, 2) }],
        };
      }

      case 'modify_labels': {
        const response = await gmail.users.messages.modify({
          userId: 'me',
          id: args?.messageId as string,
          requestBody: {
            addLabelIds: args?.addLabelIds as string[],
            removeLabelIds: args?.removeLabelIds as string[],
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, labelIds: response.data.labelIds }, null, 2),
            },
          ],
        };
      }

      case 'trash_message': {
        await gmail.users.messages.trash({
          userId: 'me',
          id: args?.messageId as string,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'get_thread': {
        const response = await gmail.users.threads.get({
          userId: 'me',
          id: args?.threadId as string,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
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
  console.error('Gmail MCP Server running on stdio');
}

main().catch(console.error);
