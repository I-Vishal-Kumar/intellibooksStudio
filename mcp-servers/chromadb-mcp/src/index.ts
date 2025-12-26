/**
 * ChromaDB MCP Server
 *
 * Provides ChromaDB vector search operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ChromaClient, Collection } from 'chromadb';

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';
const DEFAULT_COLLECTION = process.env.CHROMA_COLLECTION || 'intellibooks_knowledge';

let client: ChromaClient;
let defaultCollection: Collection | null = null;

async function getClient(): Promise<ChromaClient> {
  if (!client) {
    client = new ChromaClient({
      path: `http://${CHROMA_HOST}:${CHROMA_PORT}`,
    });
  }
  return client;
}

async function getCollection(name?: string): Promise<Collection> {
  const chromaClient = await getClient();
  const collectionName = name || DEFAULT_COLLECTION;

  if (!name && defaultCollection) {
    return defaultCollection;
  }

  const collection = await chromaClient.getOrCreateCollection({
    name: collectionName,
  });

  if (!name) {
    defaultCollection = collection;
  }

  return collection;
}

// Tool definitions
const tools = [
  {
    name: 'search',
    description: 'Perform semantic vector search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        n_results: { type: 'number', default: 10, description: 'Number of results to return' },
        collection: { type: 'string', description: 'Collection name (optional)' },
        where: { type: 'object', description: 'Metadata filter' },
        where_document: { type: 'object', description: 'Document content filter' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_documents',
    description: 'Add documents to a collection',
    inputSchema: {
      type: 'object',
      properties: {
        documents: { type: 'array', items: { type: 'string' }, description: 'Document texts' },
        ids: { type: 'array', items: { type: 'string' }, description: 'Document IDs' },
        metadatas: { type: 'array', items: { type: 'object' }, description: 'Metadata for each document' },
        collection: { type: 'string', description: 'Collection name (optional)' },
      },
      required: ['documents', 'ids'],
    },
  },
  {
    name: 'get_documents',
    description: 'Get documents by IDs',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Document IDs' },
        collection: { type: 'string', description: 'Collection name (optional)' },
        include: { type: 'array', items: { type: 'string' }, description: 'Fields to include (documents, metadatas, embeddings)' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'update_documents',
    description: 'Update existing documents',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Document IDs' },
        documents: { type: 'array', items: { type: 'string' }, description: 'New document texts' },
        metadatas: { type: 'array', items: { type: 'object' }, description: 'New metadata' },
        collection: { type: 'string', description: 'Collection name (optional)' },
      },
      required: ['ids'],
    },
  },
  {
    name: 'delete_documents',
    description: 'Delete documents by IDs or filter',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Document IDs to delete' },
        where: { type: 'object', description: 'Metadata filter for deletion' },
        collection: { type: 'string', description: 'Collection name (optional)' },
      },
    },
  },
  {
    name: 'list_collections',
    description: 'List all collections',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_collection',
    description: 'Create a new collection',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Collection name' },
        metadata: { type: 'object', description: 'Collection metadata' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_collection',
    description: 'Delete a collection',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Collection name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_collection_stats',
    description: 'Get statistics about a collection',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name (optional)' },
      },
    },
  },
  {
    name: 'peek',
    description: 'Peek at documents in a collection',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name (optional)' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
];

// Resources
const resources = [
  {
    uri: 'chromadb://collections',
    name: 'Collections',
    description: 'List of all ChromaDB collections',
    mimeType: 'application/json',
  },
  {
    uri: 'chromadb://stats',
    name: 'Database Stats',
    description: 'Overall ChromaDB statistics',
    mimeType: 'application/json',
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'chromadb-mcp',
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
      case 'search': {
        const collection = await getCollection(args?.collection as string);

        const results = await collection.query({
          queryTexts: [args?.query as string],
          nResults: (args?.n_results as number) || 10,
          where: args?.where as Record<string, unknown>,
          whereDocument: args?.where_document as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'add_documents': {
        const collection = await getCollection(args?.collection as string);

        await collection.add({
          ids: args?.ids as string[],
          documents: args?.documents as string[],
          metadatas: args?.metadatas as Record<string, unknown>[],
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, added: (args?.ids as string[]).length }, null, 2),
            },
          ],
        };
      }

      case 'get_documents': {
        const collection = await getCollection(args?.collection as string);

        const results = await collection.get({
          ids: args?.ids as string[],
          include: (args?.include as ('documents' | 'metadatas' | 'embeddings')[]) || ['documents', 'metadatas'],
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'update_documents': {
        const collection = await getCollection(args?.collection as string);

        await collection.update({
          ids: args?.ids as string[],
          documents: args?.documents as string[],
          metadatas: args?.metadatas as Record<string, unknown>[],
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'delete_documents': {
        const collection = await getCollection(args?.collection as string);

        await collection.delete({
          ids: args?.ids as string[],
          where: args?.where as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'list_collections': {
        const chromaClient = await getClient();
        const collections = await chromaClient.listCollections();

        return {
          content: [{ type: 'text', text: JSON.stringify(collections, null, 2) }],
        };
      }

      case 'create_collection': {
        const chromaClient = await getClient();

        const collection = await chromaClient.createCollection({
          name: args?.name as string,
          metadata: args?.metadata as Record<string, unknown>,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, name: collection.name }, null, 2) }],
        };
      }

      case 'delete_collection': {
        const chromaClient = await getClient();
        await chromaClient.deleteCollection({ name: args?.name as string });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'get_collection_stats': {
        const collection = await getCollection(args?.collection as string);
        const count = await collection.count();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  name: collection.name,
                  count,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'peek': {
        const collection = await getCollection(args?.collection as string);
        const results = await collection.peek({ limit: (args?.limit as number) || 10 });

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
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
      case 'chromadb://collections': {
        const chromaClient = await getClient();
        const collections = await chromaClient.listCollections();

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(collections, null, 2),
            },
          ],
        };
      }

      case 'chromadb://stats': {
        const chromaClient = await getClient();
        const collections = await chromaClient.listCollections();

        const stats = {
          totalCollections: collections.length,
          collections: [] as { name: string; count: number }[],
        };

        for (const coll of collections) {
          const collection = await chromaClient.getCollection({ name: coll.name });
          const count = await collection.count();
          stats.collections.push({ name: coll.name, count });
        }

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
  console.error('ChromaDB MCP Server running on stdio');
}

main().catch(console.error);
