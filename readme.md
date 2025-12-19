# Audio Insight Platform

A multi-team audio processing platform with transcription, translation, summarization, intent detection, and keyword extraction. Built with a **Monorepo with Internal Packages + MCP Communication Layer** architecture.

## Features

- **Audio Transcription** - Convert audio files to text using OpenAI Whisper
- **Translation** - Translate transcripts to 30+ languages
- **Summarization** - Generate summaries with key points and action items
- **Intent Detection** - Classify content into categories
- **Keyword Extraction** - Extract keywords, keyphrases, and named entities
- **RAG Pipeline** - Semantic search over processed content
- **Multi-Provider LLM** - OpenAI, Anthropic, OpenRouter support
- **MCP Integration** - Database, Teams, Slack, GitHub MCP servers

## Architecture

```
┌─────────────┐     REST/WS     ┌─────────────┐
│  NextJS UI  │<--------------->│ API Gateway │
│  (Team 1)   │                 │             │
└─────────────┘                 └──────┬──────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        v                              v                              v
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ Agent Service │           │  RAG Service  │           │ RBAC Service  │
│   (Team 3)    │           │   (Team 2)    │           │   (Team 4)    │
└───────┬───────┘           └───────┬───────┘           └───────────────┘
        │                           │
        │         MCP Protocol      │
        └───────────────────────────┘
        │                           │
        v                           v
┌───────────────┐           ┌───────────────┐
│ Database MCP  │           │ Integration   │
│               │           │ MCPs (Teams,  │
│               │           │ Slack, GitHub)│
└───────────────┘           └───────────────┘
```

## Team Ownership

| Team | Components | Responsibilities |
|------|------------|------------------|
| **Team 1: UI** | `apps/ui/` | NextJS frontend, React components |
| **Team 2: RAG** | `services/rag/` | Vector DB, embeddings, retrieval |
| **Team 3: Agents** | `services/agents/`, `packages/agent-framework/` | Agent Identity Cards, DNA Blueprint |
| **Team 4: RBAC** | `services/rbac/`, `packages/auth/` | Clerk integration, permissions |
| **Team 5: MCP** | `mcp-servers/*` | Teams, Slack, GitHub MCPs |

## Project Structure

```
audio-transcription/
├── packages/                     # Shared libraries
│   ├── core/                     # Types, schemas, utilities
│   ├── agent-framework/          # Agent Identity Cards, DNA Blueprint
│   ├── auth/                     # Clerk, RBAC middleware
│   └── ...
├── apps/
│   ├── ui/                       # NextJS application
│   └── api-gateway/              # Central API gateway
├── services/
│   ├── agents/                   # Agent service (Python/FastAPI)
│   ├── rag/                      # RAG pipeline (Python/FastAPI)
│   └── rbac/                     # RBAC service (Node/Express)
├── mcp-servers/
│   ├── database-mcp/             # Database operations
│   ├── github-mcp/               # GitHub integration
│   ├── slack-mcp/                # Slack integration
│   ├── teams-mcp/                # MS Teams integration
│   └── mcp-registry/             # MCP server discovery
├── contracts/                    # API contracts (OpenAPI)
├── infrastructure/               # Docker Compose, configs
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml           # PNPM workspaces
└── pyproject.toml                # Python monorepo config
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- pnpm 8+

### Installation

```bash
# Install JavaScript dependencies
pnpm install

# Install Python dependencies
uv sync  # or pip install -e .

# Copy environment file
cp infrastructure/docker/.env.example infrastructure/docker/.env
# Edit .env with your API keys
```

### Start Infrastructure

```bash
# Start PostgreSQL, Redis, Chroma
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Run Development Servers

```bash
# Team 1: UI (http://localhost:3001)
pnpm dev:ui

# Team 2: RAG Service (http://localhost:8002)
cd services/rag && uvicorn src.api.main:app --reload --port 8002

# Team 3: Agent Service (http://localhost:8001)
cd services/agents && uvicorn src.api.main:app --reload --port 8001

# Team 4: RBAC Service (http://localhost:8003)
cd services/rbac && pnpm dev
```

## Environment Variables

Create `infrastructure/docker/.env`:

```env
# Database
DB_PASSWORD=devpassword123

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
DEFAULT_LLM_PROVIDER=openrouter

# Whisper Model
WHISPER_MODEL=base

# Clerk Auth
CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret

# Optional: Integrations
GITHUB_TOKEN=ghp_your-github-token
SLACK_BOT_TOKEN=xoxb-your-slack-token
```

## Agent Framework

Agents are built with Identity Cards and DNA Blueprint:

```python
from agent_framework import BaseAgent, Skill, TrustLevel

class MyAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="my-agent",
            agent_type="custom",
            version="1.0.0",
            skills=[Skill(name="processing", confidence_score=0.95)],
            trust_level=TrustLevel.VERIFIED,
        )

    async def execute(self, input_data, context):
        # Agent logic here
        return AgentResult(success=True, data={...})
```

## API Endpoints

### Agent Service (port 8001)
- `POST /api/upload` - Upload audio file
- `POST /api/agents/process` - Process audio with agents
- `POST /api/agents/analyze-text` - Analyze text directly
- `GET /api/agents/registry` - List registered agents

### RAG Service (port 8002)
- `POST /api/rag/index` - Index document
- `POST /api/rag/query` - Query knowledge base
- `POST /api/rag/search` - Semantic search

### RBAC Service (port 8003)
- `POST /api/auth/verify` - Verify token
- `POST /api/auth/authorize` - Check authorization
- `GET /api/users/me` - Get current user
- `GET /api/roles` - List roles

## Development

### Git Branching

```
main (protected)
  └── develop (integration)
        ├── feature/team1/*  (UI)
        ├── feature/team2/*  (RAG)
        ├── feature/team3/*  (Agents)
        ├── feature/team4/*  (RBAC)
        └── feature/team5/*  (MCP)
```

### Testing

```bash
# JavaScript tests
pnpm test

# Python tests
pytest services/agents/tests
pytest services/rag/tests
```

### Code Formatting

```bash
# JavaScript
pnpm lint

# Python
black services/
ruff check services/ --fix
```

## Documentation

- [Architecture Guide](docs/architecture/README.md)
- [API Contracts](contracts/openapi/)
- [Agent Framework](packages/agent-framework/)

## License

MIT License
