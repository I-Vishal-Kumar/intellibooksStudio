/**
 * Google Drive MCP Server
 *
 * Provides Google Drive operations through MCP protocol
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

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Tool definitions
const tools = [
  {
    name: 'list_files',
    description: 'List files in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (Drive query syntax)' },
        pageSize: { type: 'number', default: 20, description: 'Number of files to return' },
        folderId: { type: 'string', description: 'Filter by parent folder ID' },
        mimeType: { type: 'string', description: 'Filter by MIME type' },
        orderBy: { type: 'string', default: 'modifiedTime desc', description: 'Order results' },
      },
    },
  },
  {
    name: 'get_file',
    description: 'Get file metadata by ID',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'download_file',
    description: 'Download file content (text files only)',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        mimeType: { type: 'string', description: 'Filter by MIME type' },
        maxResults: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_folder',
    description: 'Create a new folder',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
        parentId: { type: 'string', description: 'Parent folder ID' },
      },
      required: ['name'],
    },
  },
  {
    name: 'move_file',
    description: 'Move a file to a different folder',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        newParentId: { type: 'string', description: 'New parent folder ID' },
      },
      required: ['fileId', 'newParentId'],
    },
  },
  {
    name: 'rename_file',
    description: 'Rename a file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        newName: { type: 'string', description: 'New file name' },
      },
      required: ['fileId', 'newName'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file (move to trash)',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_recent',
    description: 'Get recently modified files',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'share_file',
    description: 'Share a file with specific permissions',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID' },
        email: { type: 'string', description: 'Email to share with' },
        role: { type: 'string', enum: ['reader', 'writer', 'commenter'], default: 'reader' },
      },
      required: ['fileId', 'email'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'drive-mcp',
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
      case 'list_files': {
        let q = args?.query as string || '';
        if (args?.folderId) {
          q = `'${args.folderId}' in parents${q ? ` and ${q}` : ''}`;
        }
        if (args?.mimeType) {
          q = `mimeType='${args.mimeType}'${q ? ` and ${q}` : ''}`;
        }

        const response = await drive.files.list({
          q: q || undefined,
          pageSize: (args?.pageSize as number) || 20,
          orderBy: (args?.orderBy as string) || 'modifiedTime desc',
          fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, parents, owners)',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.files, null, 2) }],
        };
      }

      case 'get_file': {
        const response = await drive.files.get({
          fileId: args?.fileId as string,
          fields: 'id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, parents, owners, shared, permissions',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'download_file': {
        const metadata = await drive.files.get({
          fileId: args?.fileId as string,
          fields: 'mimeType, name',
        });

        // Handle Google Docs export
        if (metadata.data.mimeType?.startsWith('application/vnd.google-apps')) {
          let exportMimeType = 'text/plain';
          if (metadata.data.mimeType === 'application/vnd.google-apps.document') {
            exportMimeType = 'text/plain';
          } else if (metadata.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
            exportMimeType = 'text/csv';
          }

          const response = await drive.files.export({
            fileId: args?.fileId as string,
            mimeType: exportMimeType,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    name: metadata.data.name,
                    mimeType: exportMimeType,
                    content: response.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Regular file download
        const response = await drive.files.get(
          { fileId: args?.fileId as string, alt: 'media' },
          { responseType: 'text' }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  name: metadata.data.name,
                  mimeType: metadata.data.mimeType,
                  content: response.data,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_files': {
        const query = args?.query as string;
        let q = `name contains '${query}' or fullText contains '${query}'`;
        if (args?.mimeType) {
          q += ` and mimeType='${args.mimeType}'`;
        }

        const response = await drive.files.list({
          q,
          pageSize: (args?.maxResults as number) || 20,
          fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.files, null, 2) }],
        };
      }

      case 'create_folder': {
        const response = await drive.files.create({
          requestBody: {
            name: args?.name as string,
            mimeType: 'application/vnd.google-apps.folder',
            parents: args?.parentId ? [args.parentId as string] : undefined,
          },
          fields: 'id, name, webViewLink',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'move_file': {
        const file = await drive.files.get({
          fileId: args?.fileId as string,
          fields: 'parents',
        });

        const previousParents = file.data.parents?.join(',') || '';

        const response = await drive.files.update({
          fileId: args?.fileId as string,
          addParents: args?.newParentId as string,
          removeParents: previousParents,
          fields: 'id, name, parents',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'rename_file': {
        const response = await drive.files.update({
          fileId: args?.fileId as string,
          requestBody: { name: args?.newName as string },
          fields: 'id, name',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      }

      case 'delete_file': {
        await drive.files.update({
          fileId: args?.fileId as string,
          requestBody: { trashed: true },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'get_recent': {
        const response = await drive.files.list({
          pageSize: (args?.maxResults as number) || 20,
          orderBy: 'modifiedTime desc',
          fields: 'files(id, name, mimeType, modifiedTime, webViewLink, lastModifyingUser)',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.files, null, 2) }],
        };
      }

      case 'share_file': {
        const response = await drive.permissions.create({
          fileId: args?.fileId as string,
          requestBody: {
            type: 'user',
            role: (args?.role as string) || 'reader',
            emailAddress: args?.email as string,
          },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, permissionId: response.data.id }, null, 2) }],
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
  console.error('Google Drive MCP Server running on stdio');
}

main().catch(console.error);
