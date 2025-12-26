/**
 * Azure DevOps MCP Server
 *
 * Provides Azure DevOps work item and sprint management through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const AZURE_ORG = process.env.AZURE_DEVOPS_ORG;
const AZURE_PROJECT = process.env.AZURE_DEVOPS_PROJECT;
const AZURE_PAT = process.env.AZURE_DEVOPS_PAT;

const BASE_URL = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis`;

async function azureFetch(endpoint: string, options: RequestInit = {}) {
  const auth = Buffer.from(`:${AZURE_PAT}`).toString('base64');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure DevOps API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool definitions
const tools = [
  {
    name: 'list_work_items',
    description: 'List work items using WIQL query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'WIQL query (e.g., "SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'")' },
        top: { type: 'number', default: 50, description: 'Max items to return' },
      },
    },
  },
  {
    name: 'get_work_item',
    description: 'Get work item details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        expand: { type: 'string', enum: ['None', 'Relations', 'Fields', 'Links', 'All'], default: 'All' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_work_item',
    description: 'Create a new work item',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Work item type (e.g., Task, Bug, User Story)' },
        title: { type: 'string', description: 'Work item title' },
        description: { type: 'string', description: 'Work item description (HTML supported)' },
        assignedTo: { type: 'string', description: 'Assignee email or name' },
        state: { type: 'string', description: 'Initial state' },
        priority: { type: 'number', description: 'Priority (1-4)' },
        areaPath: { type: 'string', description: 'Area path' },
        iterationPath: { type: 'string', description: 'Sprint/Iteration path' },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'update_work_item',
    description: 'Update an existing work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        title: { type: 'string', description: 'New title' },
        state: { type: 'string', description: 'New state' },
        assignedTo: { type: 'string', description: 'New assignee' },
        priority: { type: 'number', description: 'New priority' },
        description: { type: 'string', description: 'New description' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_sprints',
    description: 'List all sprints/iterations',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string', description: 'Team name (optional)' },
      },
    },
  },
  {
    name: 'get_sprint',
    description: 'Get sprint details',
    inputSchema: {
      type: 'object',
      properties: {
        iterationPath: { type: 'string', description: 'Iteration path' },
      },
      required: ['iterationPath'],
    },
  },
  {
    name: 'get_sprint_work_items',
    description: 'Get all work items in a sprint',
    inputSchema: {
      type: 'object',
      properties: {
        iterationPath: { type: 'string', description: 'Sprint iteration path' },
      },
      required: ['iterationPath'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Work item ID' },
        text: { type: 'string', description: 'Comment text (HTML supported)' },
      },
      required: ['id', 'text'],
    },
  },
  {
    name: 'list_teams',
    description: 'List all teams in the project',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_team_members',
    description: 'Get members of a team',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'string', description: 'Team name' },
      },
      required: ['team'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'azure-devops-mcp',
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
      case 'list_work_items': {
        const query = args?.query || `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${AZURE_PROJECT}' ORDER BY [System.ChangedDate] DESC`;

        const result = await azureFetch('/wit/wiql?api-version=7.0', {
          method: 'POST',
          body: JSON.stringify({ query }),
        });

        // Get work item details
        if (result.workItems?.length > 0) {
          const ids = result.workItems.slice(0, args?.top || 50).map((wi: { id: number }) => wi.id);
          const details = await azureFetch(`/wit/workitems?ids=${ids.join(',')}&api-version=7.0`);
          return {
            content: [{ type: 'text', text: JSON.stringify(details.value, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify([], null, 2) }],
        };
      }

      case 'get_work_item': {
        const result = await azureFetch(`/wit/workitems/${args?.id}?$expand=${args?.expand || 'All'}&api-version=7.0`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'create_work_item': {
        const operations = [
          { op: 'add', path: '/fields/System.Title', value: args?.title },
        ];

        if (args?.description) {
          operations.push({ op: 'add', path: '/fields/System.Description', value: args.description });
        }
        if (args?.assignedTo) {
          operations.push({ op: 'add', path: '/fields/System.AssignedTo', value: args.assignedTo });
        }
        if (args?.state) {
          operations.push({ op: 'add', path: '/fields/System.State', value: args.state });
        }
        if (args?.priority) {
          operations.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: args.priority });
        }
        if (args?.areaPath) {
          operations.push({ op: 'add', path: '/fields/System.AreaPath', value: args.areaPath });
        }
        if (args?.iterationPath) {
          operations.push({ op: 'add', path: '/fields/System.IterationPath', value: args.iterationPath });
        }

        const result = await azureFetch(`/wit/workitems/$${args?.type}?api-version=7.0`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify(operations),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'update_work_item': {
        const operations: { op: string; path: string; value: unknown }[] = [];

        if (args?.title) {
          operations.push({ op: 'add', path: '/fields/System.Title', value: args.title });
        }
        if (args?.state) {
          operations.push({ op: 'add', path: '/fields/System.State', value: args.state });
        }
        if (args?.assignedTo) {
          operations.push({ op: 'add', path: '/fields/System.AssignedTo', value: args.assignedTo });
        }
        if (args?.priority) {
          operations.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: args.priority });
        }
        if (args?.description) {
          operations.push({ op: 'add', path: '/fields/System.Description', value: args.description });
        }

        const result = await azureFetch(`/wit/workitems/${args?.id}?api-version=7.0`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          body: JSON.stringify(operations),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_sprints': {
        const team = args?.team || `${AZURE_PROJECT} Team`;
        const result = await azureFetch(`/${team}/_apis/work/teamsettings/iterations?api-version=7.0`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }],
        };
      }

      case 'get_sprint': {
        const query = `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${args?.iterationPath}'`;
        const result = await azureFetch('/wit/wiql?api-version=7.0', {
          method: 'POST',
          body: JSON.stringify({ query }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_sprint_work_items': {
        const query = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE [System.IterationPath] = '${args?.iterationPath}' ORDER BY [System.State]`;

        const result = await azureFetch('/wit/wiql?api-version=7.0', {
          method: 'POST',
          body: JSON.stringify({ query }),
        });

        if (result.workItems?.length > 0) {
          const ids = result.workItems.map((wi: { id: number }) => wi.id);
          const details = await azureFetch(`/wit/workitems?ids=${ids.join(',')}&api-version=7.0`);
          return {
            content: [{ type: 'text', text: JSON.stringify(details.value, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify([], null, 2) }],
        };
      }

      case 'add_comment': {
        const result = await azureFetch(`/wit/workitems/${args?.id}/comments?api-version=7.0-preview.3`, {
          method: 'POST',
          body: JSON.stringify({ text: args?.text }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_teams': {
        const result = await azureFetch('/teams?api-version=7.0');
        return {
          content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }],
        };
      }

      case 'get_team_members': {
        const result = await azureFetch(`/teams/${encodeURIComponent(args?.team as string)}/members?api-version=7.0`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }],
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
  console.error('Azure DevOps MCP Server running on stdio');
}

main().catch(console.error);
