/**
 * ClickUp MCP Server
 *
 * Provides ClickUp task management through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

async function clickupFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${CLICKUP_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': CLICKUP_TOKEN || '',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ClickUp API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool definitions
const tools = [
  {
    name: 'list_tasks',
    description: 'List tasks in a ClickUp list',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'List ID' },
        statuses: { type: 'array', items: { type: 'string' }, description: 'Filter by status' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Filter by assignee IDs' },
        include_closed: { type: 'boolean', default: false },
      },
      required: ['listId'],
    },
  },
  {
    name: 'get_task',
    description: 'Get task details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string', description: 'List ID to create task in' },
        name: { type: 'string', description: 'Task name' },
        description: { type: 'string', description: 'Task description (markdown supported)' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Assignee user IDs' },
        priority: { type: 'number', description: '1=Urgent, 2=High, 3=Normal, 4=Low' },
        due_date: { type: 'number', description: 'Due date as Unix timestamp (ms)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
      },
      required: ['listId', 'name'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
        name: { type: 'string', description: 'New task name' },
        description: { type: 'string', description: 'New description' },
        status: { type: 'string', description: 'New status' },
        priority: { type: 'number', description: '1=Urgent, 2=High, 3=Normal, 4=Low' },
        due_date: { type: 'number', description: 'Due date as Unix timestamp (ms)' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
        comment: { type: 'string', description: 'Comment text' },
      },
      required: ['taskId', 'comment'],
    },
  },
  {
    name: 'list_workspaces',
    description: 'List all workspaces (teams)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_spaces',
    description: 'List spaces in a workspace',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team/Workspace ID' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'list_folders',
    description: 'List folders in a space',
    inputSchema: {
      type: 'object',
      properties: {
        spaceId: { type: 'string', description: 'Space ID' },
      },
      required: ['spaceId'],
    },
  },
  {
    name: 'list_lists',
    description: 'List all lists in a folder or space',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'string', description: 'Folder ID (optional if spaceId provided)' },
        spaceId: { type: 'string', description: 'Space ID (for folderless lists)' },
      },
    },
  },
  {
    name: 'search_tasks',
    description: 'Search for tasks across the workspace',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team/Workspace ID' },
        query: { type: 'string', description: 'Search query' },
      },
      required: ['teamId', 'query'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'clickup-mcp',
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
      case 'list_tasks': {
        const params = new URLSearchParams();
        if (args?.statuses) {
          (args.statuses as string[]).forEach(s => params.append('statuses[]', s));
        }
        if (args?.assignees) {
          (args.assignees as string[]).forEach(a => params.append('assignees[]', a));
        }
        if (args?.include_closed) {
          params.append('include_closed', 'true');
        }

        const result = await clickupFetch(`/list/${args?.listId}/task?${params}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.tasks, null, 2) }],
        };
      }

      case 'get_task': {
        const result = await clickupFetch(`/task/${args?.taskId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'create_task': {
        const body: Record<string, unknown> = {
          name: args?.name,
        };
        if (args?.description) body.description = args.description;
        if (args?.assignees) body.assignees = args.assignees;
        if (args?.priority) body.priority = args.priority;
        if (args?.due_date) body.due_date = args.due_date;
        if (args?.tags) body.tags = args.tags;

        const result = await clickupFetch(`/list/${args?.listId}/task`, {
          method: 'POST',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'update_task': {
        const body: Record<string, unknown> = {};
        if (args?.name) body.name = args.name;
        if (args?.description) body.description = args.description;
        if (args?.status) body.status = args.status;
        if (args?.priority) body.priority = args.priority;
        if (args?.due_date) body.due_date = args.due_date;

        const result = await clickupFetch(`/task/${args?.taskId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'delete_task': {
        await clickupFetch(`/task/${args?.taskId}`, { method: 'DELETE' });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'add_comment': {
        const result = await clickupFetch(`/task/${args?.taskId}/comment`, {
          method: 'POST',
          body: JSON.stringify({ comment_text: args?.comment }),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_workspaces': {
        const result = await clickupFetch('/team');
        return {
          content: [{ type: 'text', text: JSON.stringify(result.teams, null, 2) }],
        };
      }

      case 'list_spaces': {
        const result = await clickupFetch(`/team/${args?.teamId}/space`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.spaces, null, 2) }],
        };
      }

      case 'list_folders': {
        const result = await clickupFetch(`/space/${args?.spaceId}/folder`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.folders, null, 2) }],
        };
      }

      case 'list_lists': {
        let result;
        if (args?.folderId) {
          result = await clickupFetch(`/folder/${args.folderId}/list`);
        } else if (args?.spaceId) {
          result = await clickupFetch(`/space/${args.spaceId}/list`);
        } else {
          return {
            content: [{ type: 'text', text: 'Either folderId or spaceId is required' }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result.lists, null, 2) }],
        };
      }

      case 'search_tasks': {
        const result = await clickupFetch(
          `/team/${args?.teamId}/task?query=${encodeURIComponent(args?.query as string)}`
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result.tasks, null, 2) }],
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
  console.error('ClickUp MCP Server running on stdio');
}

main().catch(console.error);
