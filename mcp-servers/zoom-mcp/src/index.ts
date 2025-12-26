/**
 * Zoom MCP Server
 *
 * Provides Zoom meeting management and recordings through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ZOOM_API_URL = 'https://api.zoom.us/v2';
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
  });

  if (!response.ok) {
    throw new Error(`Failed to get Zoom access token: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return accessToken!;
}

async function zoomFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${ZOOM_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Tool definitions
const tools = [
  {
    name: 'list_meetings',
    description: 'List scheduled meetings',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', default: 'me', description: 'User ID or "me"' },
        type: { type: 'string', enum: ['scheduled', 'live', 'upcoming', 'previous'], default: 'scheduled' },
        page_size: { type: 'number', default: 30 },
      },
    },
  },
  {
    name: 'get_meeting',
    description: 'Get meeting details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'create_meeting',
    description: 'Create a new meeting',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Meeting topic' },
        type: { type: 'number', description: '1=Instant, 2=Scheduled, 3=Recurring no fixed time, 8=Recurring fixed time', default: 2 },
        start_time: { type: 'string', description: 'Start time (ISO 8601)' },
        duration: { type: 'number', description: 'Duration in minutes' },
        timezone: { type: 'string', description: 'Timezone' },
        agenda: { type: 'string', description: 'Meeting agenda' },
        password: { type: 'string', description: 'Meeting password' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'update_meeting',
    description: 'Update a meeting',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
        topic: { type: 'string', description: 'New topic' },
        start_time: { type: 'string', description: 'New start time' },
        duration: { type: 'number', description: 'New duration' },
        agenda: { type: 'string', description: 'New agenda' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'delete_meeting',
    description: 'Delete a meeting',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'get_meeting_participants',
    description: 'Get participants of a past meeting',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID (UUID)' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'list_recordings',
    description: 'List cloud recordings',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', default: 'me', description: 'User ID or "me"' },
        from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'get_recording',
    description: 'Get recording details',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'get_transcript',
    description: 'Get meeting transcript (if available)',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'get_meeting_summary',
    description: 'Get AI-generated meeting summary (if available)',
    inputSchema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Meeting ID' },
      },
      required: ['meetingId'],
    },
  },
  {
    name: 'list_users',
    description: 'List users in the account',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive', 'pending'], default: 'active' },
        page_size: { type: 'number', default: 30 },
      },
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'zoom-mcp',
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
      case 'list_meetings': {
        const userId = (args?.userId as string) || 'me';
        const type = (args?.type as string) || 'scheduled';
        const result = await zoomFetch(`/users/${userId}/meetings?type=${type}&page_size=${args?.page_size || 30}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.meetings, null, 2) }],
        };
      }

      case 'get_meeting': {
        const result = await zoomFetch(`/meetings/${args?.meetingId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'create_meeting': {
        const body: Record<string, unknown> = {
          topic: args?.topic,
          type: args?.type || 2,
        };
        if (args?.start_time) body.start_time = args.start_time;
        if (args?.duration) body.duration = args.duration;
        if (args?.timezone) body.timezone = args.timezone;
        if (args?.agenda) body.agenda = args.agenda;
        if (args?.password) body.password = args.password;

        const result = await zoomFetch('/users/me/meetings', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'update_meeting': {
        const body: Record<string, unknown> = {};
        if (args?.topic) body.topic = args.topic;
        if (args?.start_time) body.start_time = args.start_time;
        if (args?.duration) body.duration = args.duration;
        if (args?.agenda) body.agenda = args.agenda;

        await zoomFetch(`/meetings/${args?.meetingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'delete_meeting': {
        await zoomFetch(`/meetings/${args?.meetingId}`, { method: 'DELETE' });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      case 'get_meeting_participants': {
        const result = await zoomFetch(`/past_meetings/${encodeURIComponent(args?.meetingId as string)}/participants`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.participants, null, 2) }],
        };
      }

      case 'list_recordings': {
        const userId = (args?.userId as string) || 'me';
        const params = new URLSearchParams();
        if (args?.from) params.append('from', args.from as string);
        if (args?.to) params.append('to', args.to as string);

        const result = await zoomFetch(`/users/${userId}/recordings?${params}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.meetings, null, 2) }],
        };
      }

      case 'get_recording': {
        const result = await zoomFetch(`/meetings/${args?.meetingId}/recordings`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_transcript': {
        const recording = await zoomFetch(`/meetings/${args?.meetingId}/recordings`);

        // Find transcript file
        const transcriptFile = recording.recording_files?.find(
          (f: { file_type: string }) => f.file_type === 'TRANSCRIPT'
        );

        if (!transcriptFile) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'No transcript available' }, null, 2) }],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  download_url: transcriptFile.download_url,
                  file_type: transcriptFile.file_type,
                  recording_start: transcriptFile.recording_start,
                  recording_end: transcriptFile.recording_end,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_meeting_summary': {
        try {
          const result = await zoomFetch(`/meetings/${args?.meetingId}/meeting_summary`);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Meeting summary not available' }, null, 2) }],
          };
        }
      }

      case 'list_users': {
        const result = await zoomFetch(`/users?status=${args?.status || 'active'}&page_size=${args?.page_size || 30}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result.users, null, 2) }],
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
  console.error('Zoom MCP Server running on stdio');
}

main().catch(console.error);
