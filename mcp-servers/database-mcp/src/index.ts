/**
 * Database MCP Server
 *
 * Provides database operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { z } from 'zod';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Tool definitions
const tools = [
  {
    name: 'query_transcripts',
    description: 'Query transcripts from the database with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Filter by user ID' },
        language: { type: 'string', description: 'Filter by detected language' },
        startDate: { type: 'string', format: 'date-time', description: 'Filter by date range start' },
        endDate: { type: 'string', format: 'date-time', description: 'Filter by date range end' },
        searchText: { type: 'string', description: 'Full-text search in transcript content' },
        limit: { type: 'number', default: 10, description: 'Maximum results to return' },
        offset: { type: 'number', default: 0, description: 'Offset for pagination' },
      },
    },
  },
  {
    name: 'get_transcript',
    description: 'Get a specific transcript by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transcript ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_audio_file',
    description: 'Get audio file metadata by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Audio file ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_audio_files',
    description: 'List audio files with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Filter by user ID' },
        status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
        limit: { type: 'number', default: 10 },
        offset: { type: 'number', default: 0 },
      },
    },
  },
  {
    name: 'get_processing_job',
    description: 'Get processing job status by ID',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job ID' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'execute_sql',
    description: 'Execute a read-only SQL query (SELECT only)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL SELECT query' },
        params: { type: 'array', items: { type: 'string' }, description: 'Query parameters' },
      },
      required: ['query'],
    },
  },
];

// Resources (schemas/tables info)
const resources = [
  {
    uri: 'db://schemas',
    name: 'Database Schemas',
    description: 'List of database schemas',
    mimeType: 'application/json',
  },
  {
    uri: 'db://audio/tables',
    name: 'Audio Schema Tables',
    description: 'Tables in the audio schema',
    mimeType: 'application/json',
  },
  {
    uri: 'db://agents/tables',
    name: 'Agents Schema Tables',
    description: 'Tables in the agents schema',
    mimeType: 'application/json',
  },
  {
    uri: 'db://auth/tables',
    name: 'Auth Schema Tables',
    description: 'Tables in the auth schema',
    mimeType: 'application/json',
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'database-mcp',
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
      case 'query_transcripts': {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (args?.userId) {
          conditions.push(`user_id = $${paramIndex++}`);
          params.push(args.userId);
        }

        if (args?.language) {
          conditions.push(`language = $${paramIndex++}`);
          params.push(args.language);
        }

        if (args?.startDate) {
          conditions.push(`created_at >= $${paramIndex++}`);
          params.push(args.startDate);
        }

        if (args?.endDate) {
          conditions.push(`created_at <= $${paramIndex++}`);
          params.push(args.endDate);
        }

        if (args?.searchText) {
          conditions.push(`text_content @@ plainto_tsquery($${paramIndex++})`);
          params.push(args.searchText);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = args?.limit || 10;
        const offset = args?.offset || 0;

        params.push(limit, offset);

        const result = await pool.query(
          `SELECT id, audio_file_id, text_content, language, confidence, word_timestamps, created_at
           FROM audio.transcripts
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          params
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }],
        };
      }

      case 'get_transcript': {
        const result = await pool.query(
          `SELECT t.*, a.filename, a.duration_seconds
           FROM audio.transcripts t
           LEFT JOIN audio.audio_files a ON a.id = t.audio_file_id
           WHERE t.id = $1`,
          [args?.id]
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: 'text', text: 'Transcript not found' }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }],
        };
      }

      case 'get_audio_file': {
        const result = await pool.query(
          `SELECT * FROM audio.audio_files WHERE id = $1`,
          [args?.id]
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: 'text', text: 'Audio file not found' }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }],
        };
      }

      case 'list_audio_files': {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (args?.userId) {
          conditions.push(`user_id = $${paramIndex++}`);
          params.push(args.userId);
        }

        if (args?.status) {
          conditions.push(`status = $${paramIndex++}`);
          params.push(args.status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = args?.limit || 10;
        const offset = args?.offset || 0;

        params.push(limit, offset);

        const result = await pool.query(
          `SELECT id, filename, file_size, duration_seconds, status, created_at
           FROM audio.audio_files
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          params
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }],
        };
      }

      case 'get_processing_job': {
        const result = await pool.query(
          `SELECT * FROM audio.processing_jobs WHERE id = $1`,
          [args?.jobId]
        );

        if (result.rows.length === 0) {
          return {
            content: [{ type: 'text', text: 'Job not found' }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result.rows[0], null, 2) }],
        };
      }

      case 'execute_sql': {
        const query = args?.query as string;

        // Security: Only allow SELECT queries
        if (!query.trim().toLowerCase().startsWith('select')) {
          return {
            content: [{ type: 'text', text: 'Only SELECT queries are allowed' }],
            isError: true,
          };
        }

        const result = await pool.query(query, args?.params || []);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  rowCount: result.rowCount,
                  rows: result.rows,
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

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'db://schemas': {
        const result = await pool.query(
          `SELECT schema_name FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
           ORDER BY schema_name`
        );

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result.rows.map((r) => r.schema_name), null, 2),
            },
          ],
        };
      }

      case 'db://audio/tables':
      case 'db://agents/tables':
      case 'db://auth/tables': {
        const schema = uri.split('/')[2];

        const result = await pool.query(
          `SELECT table_name, column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_schema = $1
           ORDER BY table_name, ordinal_position`,
          [schema]
        );

        // Group columns by table
        const tables: Record<string, Array<{ column: string; type: string; nullable: boolean }>> =
          {};
        for (const row of result.rows) {
          if (!tables[row.table_name]) {
            tables[row.table_name] = [];
          }
          tables[row.table_name].push({
            column: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable === 'YES',
          });
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(tables, null, 2),
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
  console.error('Database MCP Server running on stdio');
}

main().catch(console.error);
