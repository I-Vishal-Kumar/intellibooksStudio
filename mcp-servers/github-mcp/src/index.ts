/**
 * GitHub MCP Server
 *
 * Provides GitHub operations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Tool definitions
const tools = [
  {
    name: 'create_issue',
    description: 'Create a new GitHub issue',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Assignees' },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'list_issues',
    description: 'List issues in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        labels: { type: 'string', description: 'Comma-separated list of labels' },
        per_page: { type: 'number', default: 10 },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'get_issue',
    description: 'Get a specific issue',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: { type: 'number', description: 'Issue number' },
      },
      required: ['owner', 'repo', 'issue_number'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to an issue or pull request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: { type: 'number', description: 'Issue or PR number' },
        body: { type: 'string', description: 'Comment body' },
      },
      required: ['owner', 'repo', 'issue_number', 'body'],
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        per_page: { type: 'number', default: 10 },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'get_pull_request',
    description: 'Get a specific pull request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        pull_number: { type: 'number', description: 'Pull request number' },
      },
      required: ['owner', 'repo', 'pull_number'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a new pull request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR body' },
        head: { type: 'string', description: 'Source branch' },
        base: { type: 'string', description: 'Target branch' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
  },
  {
    name: 'get_repo',
    description: 'Get repository information',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'list_branches',
    description: 'List branches in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        per_page: { type: 'number', default: 30 },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code in repositories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        per_page: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'github-mcp',
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
      case 'create_issue': {
        const response = await octokit.issues.create({
          owner: args?.owner as string,
          repo: args?.repo as string,
          title: args?.title as string,
          body: args?.body as string,
          labels: args?.labels as string[],
          assignees: args?.assignees as string[],
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  number: response.data.number,
                  url: response.data.html_url,
                  title: response.data.title,
                  state: response.data.state,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_issues': {
        const response = await octokit.issues.listForRepo({
          owner: args?.owner as string,
          repo: args?.repo as string,
          state: (args?.state as 'open' | 'closed' | 'all') || 'open',
          labels: args?.labels as string,
          per_page: (args?.per_page as number) || 10,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.data.map((issue) => ({
                  number: issue.number,
                  title: issue.title,
                  state: issue.state,
                  labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
                  url: issue.html_url,
                  created_at: issue.created_at,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_issue': {
        const response = await octokit.issues.get({
          owner: args?.owner as string,
          repo: args?.repo as string,
          issue_number: args?.issue_number as number,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  number: response.data.number,
                  title: response.data.title,
                  body: response.data.body,
                  state: response.data.state,
                  labels: response.data.labels.map((l) => (typeof l === 'string' ? l : l.name)),
                  assignees: response.data.assignees?.map((a) => a.login),
                  url: response.data.html_url,
                  created_at: response.data.created_at,
                  updated_at: response.data.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'add_comment': {
        const response = await octokit.issues.createComment({
          owner: args?.owner as string,
          repo: args?.repo as string,
          issue_number: args?.issue_number as number,
          body: args?.body as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: response.data.id,
                  url: response.data.html_url,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_pull_requests': {
        const response = await octokit.pulls.list({
          owner: args?.owner as string,
          repo: args?.repo as string,
          state: (args?.state as 'open' | 'closed' | 'all') || 'open',
          per_page: (args?.per_page as number) || 10,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.data.map((pr) => ({
                  number: pr.number,
                  title: pr.title,
                  state: pr.state,
                  head: pr.head.ref,
                  base: pr.base.ref,
                  url: pr.html_url,
                  created_at: pr.created_at,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_pull_request': {
        const response = await octokit.pulls.get({
          owner: args?.owner as string,
          repo: args?.repo as string,
          pull_number: args?.pull_number as number,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  number: response.data.number,
                  title: response.data.title,
                  body: response.data.body,
                  state: response.data.state,
                  head: response.data.head.ref,
                  base: response.data.base.ref,
                  mergeable: response.data.mergeable,
                  url: response.data.html_url,
                  created_at: response.data.created_at,
                  updated_at: response.data.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'create_pull_request': {
        const response = await octokit.pulls.create({
          owner: args?.owner as string,
          repo: args?.repo as string,
          title: args?.title as string,
          body: args?.body as string,
          head: args?.head as string,
          base: args?.base as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  number: response.data.number,
                  url: response.data.html_url,
                  title: response.data.title,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_repo': {
        const response = await octokit.repos.get({
          owner: args?.owner as string,
          repo: args?.repo as string,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  name: response.data.name,
                  full_name: response.data.full_name,
                  description: response.data.description,
                  default_branch: response.data.default_branch,
                  visibility: response.data.visibility,
                  url: response.data.html_url,
                  stars: response.data.stargazers_count,
                  forks: response.data.forks_count,
                  open_issues: response.data.open_issues_count,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_branches': {
        const response = await octokit.repos.listBranches({
          owner: args?.owner as string,
          repo: args?.repo as string,
          per_page: (args?.per_page as number) || 30,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                response.data.map((branch) => ({
                  name: branch.name,
                  protected: branch.protected,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_code': {
        const response = await octokit.search.code({
          q: args?.query as string,
          per_page: (args?.per_page as number) || 10,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total_count: response.data.total_count,
                  items: response.data.items.map((item) => ({
                    name: item.name,
                    path: item.path,
                    repository: item.repository.full_name,
                    url: item.html_url,
                  })),
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
  console.error('GitHub MCP Server running on stdio');
}

main().catch(console.error);
