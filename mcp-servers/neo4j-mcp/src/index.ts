/**
 * Neo4j MCP Server
 *
 * Provides Neo4j knowledge graph operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import neo4j, { Driver, Session } from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

let driver: Driver;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  }
  return driver;
}

async function runQuery(cypher: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  const session: Session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
  }
}

// Tool definitions
const tools = [
  {
    name: 'query_graph',
    description: 'Execute a Cypher query on the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        cypher: { type: 'string', description: 'Cypher query' },
        params: { type: 'object', description: 'Query parameters' },
      },
      required: ['cypher'],
    },
  },
  {
    name: 'find_entities',
    description: 'Find entities by name or type',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Entity name (partial match)' },
        type: { type: 'string', description: 'Entity type/label' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'find_paths',
    description: 'Find paths between two entities',
    inputSchema: {
      type: 'object',
      properties: {
        startEntity: { type: 'string', description: 'Starting entity name' },
        endEntity: { type: 'string', description: 'Ending entity name' },
        maxDepth: { type: 'number', default: 4, description: 'Maximum path depth' },
        relationshipTypes: { type: 'array', items: { type: 'string' }, description: 'Filter by relationship types' },
      },
      required: ['startEntity', 'endEntity'],
    },
  },
  {
    name: 'add_entity',
    description: 'Add a new entity to the graph',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Entity name' },
        type: { type: 'string', description: 'Entity type/label' },
        properties: { type: 'object', description: 'Additional properties' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'add_relationship',
    description: 'Create a relationship between entities',
    inputSchema: {
      type: 'object',
      properties: {
        fromEntity: { type: 'string', description: 'Source entity name' },
        toEntity: { type: 'string', description: 'Target entity name' },
        relationshipType: { type: 'string', description: 'Relationship type (e.g., KNOWS, BELONGS_TO)' },
        properties: { type: 'object', description: 'Relationship properties' },
      },
      required: ['fromEntity', 'toEntity', 'relationshipType'],
    },
  },
  {
    name: 'get_neighbors',
    description: 'Get all entities connected to a given entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Entity name' },
        direction: { type: 'string', enum: ['in', 'out', 'both'], default: 'both' },
        relationshipType: { type: 'string', description: 'Filter by relationship type' },
        limit: { type: 'number', default: 50 },
      },
      required: ['entityName'],
    },
  },
  {
    name: 'get_entity_details',
    description: 'Get all properties and relationships of an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Entity name' },
      },
      required: ['entityName'],
    },
  },
  {
    name: 'delete_entity',
    description: 'Delete an entity and its relationships',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Entity name' },
      },
      required: ['entityName'],
    },
  },
  {
    name: 'get_graph_stats',
    description: 'Get statistics about the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_by_property',
    description: 'Search entities by property value',
    inputSchema: {
      type: 'object',
      properties: {
        property: { type: 'string', description: 'Property name' },
        value: { type: 'string', description: 'Property value (partial match)' },
        entityType: { type: 'string', description: 'Filter by entity type' },
        limit: { type: 'number', default: 20 },
      },
      required: ['property', 'value'],
    },
  },
];

// Resources
const resources = [
  {
    uri: 'neo4j://labels',
    name: 'Node Labels',
    description: 'All node labels in the graph',
    mimeType: 'application/json',
  },
  {
    uri: 'neo4j://relationships',
    name: 'Relationship Types',
    description: 'All relationship types in the graph',
    mimeType: 'application/json',
  },
  {
    uri: 'neo4j://schema',
    name: 'Graph Schema',
    description: 'Schema information including constraints and indexes',
    mimeType: 'application/json',
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'neo4j-mcp',
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
      case 'query_graph': {
        const result = await runQuery(args?.cypher as string, (args?.params as Record<string, unknown>) || {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'find_entities': {
        let cypher = 'MATCH (n)';
        const conditions: string[] = [];
        const params: Record<string, unknown> = {};

        if (args?.type) {
          cypher = `MATCH (n:\`${args.type}\`)`;
        }

        if (args?.name) {
          conditions.push('toLower(n.name) CONTAINS toLower($name)');
          params.name = args.name;
        }

        if (conditions.length > 0) {
          cypher += ` WHERE ${conditions.join(' AND ')}`;
        }

        cypher += ` RETURN n LIMIT ${args?.limit || 20}`;

        const result = await runQuery(cypher, params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'find_paths': {
        let relFilter = '';
        if (args?.relationshipTypes && (args.relationshipTypes as string[]).length > 0) {
          relFilter = `:${(args.relationshipTypes as string[]).join('|')}`;
        }

        const cypher = `
          MATCH (start), (end)
          WHERE toLower(start.name) = toLower($startEntity)
            AND toLower(end.name) = toLower($endEntity)
          MATCH path = shortestPath((start)-[${relFilter}*1..${args?.maxDepth || 4}]-(end))
          RETURN path
        `;

        const result = await runQuery(cypher, {
          startEntity: args?.startEntity,
          endEntity: args?.endEntity,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'add_entity': {
        const props = { name: args?.name, ...(args?.properties as Record<string, unknown> || {}) };
        const cypher = `
          MERGE (n:\`${args?.type}\` {name: $name})
          SET n += $props
          RETURN n
        `;

        const result = await runQuery(cypher, { name: args?.name, props });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'add_relationship': {
        const props = (args?.properties as Record<string, unknown>) || {};
        const cypher = `
          MATCH (a), (b)
          WHERE toLower(a.name) = toLower($from) AND toLower(b.name) = toLower($to)
          MERGE (a)-[r:\`${args?.relationshipType}\`]->(b)
          SET r += $props
          RETURN a, r, b
        `;

        const result = await runQuery(cypher, {
          from: args?.fromEntity,
          to: args?.toEntity,
          props,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_neighbors': {
        let pattern = '(n)-[r]-(neighbor)';
        if (args?.direction === 'out') {
          pattern = '(n)-[r]->(neighbor)';
        } else if (args?.direction === 'in') {
          pattern = '(n)<-[r]-(neighbor)';
        }

        let relFilter = '';
        if (args?.relationshipType) {
          relFilter = `:\`${args.relationshipType}\``;
        }

        const cypher = `
          MATCH ${pattern.replace('[r]', `[r${relFilter}]`)}
          WHERE toLower(n.name) = toLower($name)
          RETURN neighbor, type(r) as relationship
          LIMIT ${args?.limit || 50}
        `;

        const result = await runQuery(cypher, { name: args?.entityName });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_entity_details': {
        const cypher = `
          MATCH (n)
          WHERE toLower(n.name) = toLower($name)
          OPTIONAL MATCH (n)-[r]-(connected)
          RETURN n as entity, labels(n) as labels,
                 collect({relationship: type(r), connected: connected.name}) as connections
        `;

        const result = await runQuery(cypher, { name: args?.entityName });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'delete_entity': {
        const cypher = `
          MATCH (n)
          WHERE toLower(n.name) = toLower($name)
          DETACH DELETE n
          RETURN count(n) as deleted
        `;

        const result = await runQuery(cypher, { name: args?.entityName });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_graph_stats': {
        const nodeCount = await runQuery('MATCH (n) RETURN count(n) as count');
        const relCount = await runQuery('MATCH ()-[r]->() RETURN count(r) as count');
        const labels = await runQuery('CALL db.labels() YIELD label RETURN collect(label) as labels');
        const relTypes = await runQuery('CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) as types');

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  nodeCount: (nodeCount[0] as { count: number })?.count || 0,
                  relationshipCount: (relCount[0] as { count: number })?.count || 0,
                  labels: (labels[0] as { labels: string[] })?.labels || [],
                  relationshipTypes: (relTypes[0] as { types: string[] })?.types || [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_by_property': {
        let cypher = 'MATCH (n)';
        if (args?.entityType) {
          cypher = `MATCH (n:\`${args.entityType}\`)`;
        }

        cypher += `
          WHERE toLower(toString(n.\`${args?.property}\`)) CONTAINS toLower($value)
          RETURN n
          LIMIT ${args?.limit || 20}
        `;

        const result = await runQuery(cypher, { value: args?.value });
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

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'neo4j://labels': {
        const result = await runQuery('CALL db.labels() YIELD label RETURN label');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result.map((r: unknown) => (r as { label: string }).label), null, 2),
            },
          ],
        };
      }

      case 'neo4j://relationships': {
        const result = await runQuery('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(result.map((r: unknown) => (r as { relationshipType: string }).relationshipType), null, 2),
            },
          ],
        };
      }

      case 'neo4j://schema': {
        const constraints = await runQuery('SHOW CONSTRAINTS');
        const indexes = await runQuery('SHOW INDEXES');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ constraints, indexes }, null, 2),
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
  console.error('Neo4j MCP Server running on stdio');
}

// Cleanup on exit
process.on('SIGINT', async () => {
  if (driver) {
    await driver.close();
  }
  process.exit(0);
});

main().catch(console.error);
