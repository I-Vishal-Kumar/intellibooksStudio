# Intellibooks Studio - Architecture Guide

## Overview

Intellibooks Studio is a multi-team monorepo platform for document intelligence, audio transcription, translation, summarization, RAG, intent detection, and keyword extraction. It uses a **Monorepo with Internal Packages + MCP Communication Layer** architecture.

## Architecture Diagram

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
          │                         │
          v                         v
    ┌───────────┐           ┌───────────────┐
    │ PostgreSQL│           │ External APIs │
    │ + Chroma  │           │               │
    └───────────┘           └───────────────┘
```

## Team Ownership

| Team | Components | Responsibilities |
|------|------------|------------------|
| **Team 1: UI** | `apps/ui/` | NextJS frontend, React components, user experience |
| **Team 2: RAG** | `services/rag/` | Vector DB, embeddings, semantic retrieval |
| **Team 3: Agents** | `services/agents/`, `packages/agent-framework/` | Agent Identity Cards, DNA Blueprint, orchestration |
| **Team 4: RBAC** | `services/rbac/`, `packages/auth/` | Clerk integration, permissions, access control |
| **Team 5: MCP** | `mcp-servers/*` | Teams, Slack, GitHub integrations |

## Project Structure

```
IntelliBooksStudio/
├── packages/                     # Shared libraries (npm/pip packages)
│   ├── core/                     # @audio-insight/core - Types, schemas, utilities
│   ├── agent-framework/          # Agent Identity Cards, DNA Blueprint
│   ├── llm-abstraction/          # Multi-provider LLM routing
│   ├── database/                 # Models, repositories, migrations
│   ├── auth/                     # Clerk, RBAC middleware
│   └── integration-clients/      # Teams, Slack, GitHub clients
│
├── apps/
│   ├── ui/                       # Team 1: NextJS application
│   └── api-gateway/              # Central API gateway (FastAPI/Express)
│
├── services/
│   ├── agents/                   # Team 3: Agent service
│   ├── rag/                      # Team 2: RAG pipeline
│   └── rbac/                     # Team 4: RBAC service
│
├── mcp-servers/                  # Team 5: MCP integrations
│   ├── database-mcp/             # Database operations MCP
│   ├── teams-mcp/                # Microsoft Teams MCP
│   ├── slack-mcp/                # Slack MCP
│   ├── github-mcp/               # GitHub MCP
│   └── mcp-registry/             # MCP Server discovery
│
├── contracts/                    # API contracts
│   ├── openapi/                  # OpenAPI specifications
│   ├── events/                   # Event schemas
│   └── mcp-schemas/              # MCP tool schemas
│
├── infrastructure/
│   └── docker/                   # Docker Compose files
│
├── turbo.json                    # Turborepo configuration
├── pnpm-workspace.yaml           # PNPM workspaces
└── pyproject.toml                # Python monorepo config
```

## Agent Framework

### Agent Identity Card

Every agent has an Identity Card that provides:
- Unique identification
- Capabilities manifest with confidence scores
- Trust level management
- Digital signature verification

```python
from agent_framework import AgentIdentityCard, Skill, TrustLevel

identity = AgentIdentityCard(
    agent_id="jai-transcription-v1.0.0-prod-abc123",
    agent_type="transcription",
    version="1.0.0",
    capabilities=CapabilitiesManifest(
        skills=[
            Skill(name="transcription", confidence_score=0.95),
            Skill(name="language_detection", confidence_score=0.90),
        ]
    ),
    trust_level=TrustLevel.VERIFIED,
)
```

### Agent DNA Blueprint

The DNA Blueprint defines agent architecture with 7 layers:

1. **Cognitive Layer**: Reasoning, Planning, Reflection
2. **Knowledge Layer**: RAG Engine, Graph Query, Memory
3. **Execution Layer**: Tool Use, Actions, Workflows
4. **Safety Layer**: Guardrails, Compliance
5. **Learning Layer**: Feedback, Adaptation
6. **Social Layer**: A2A Communication, Delegation
7. **Observability**: Metrics, Tracing, Logging

```python
from agent_framework import (
    AgentDNABlueprint,
    BlueprintBuilder,
    CognitiveLayer,
    ExecutionLayer,
)

blueprint = (
    BlueprintBuilder()
    .with_cognitive(reasoning=MyReasoningEngine())
    .with_execution(tool_use=MyToolModule())
    .with_safety(guardrails=MyGuardrails())
    .build()
)
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL 16 | Primary data store with schema isolation |
| **Vector Store** | Chroma | Embeddings for RAG pipeline |
| **Cache/Events** | Redis | Caching and Pub/Sub messaging |
| **UI Framework** | Next.js 14 | React-based frontend |
| **API Gateway** | FastAPI / Express | Request routing and auth |
| **Auth** | Clerk | Authentication and RBAC |
| **LLM Providers** | OpenAI, Anthropic, OpenRouter | AI capabilities |
| **Audio Processing** | OpenAI Whisper | Transcription |
| **Orchestration** | LangGraph | Agent workflow management |

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- pnpm 8+

### Quick Start

```bash
# Clone and install
git clone <repo>
cd IntelliBooksStudio
pnpm install

# Start infrastructure
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Run development servers
pnpm dev:ui        # Team 1: UI at http://localhost:3001
pnpm dev:agents    # Team 3: Agents at http://localhost:8001
pnpm dev:rag       # Team 2: RAG at http://localhost:8002
pnpm dev:rbac      # Team 4: RBAC at http://localhost:8003
```

### Environment Setup

Copy the example environment file:

```bash
cp infrastructure/docker/.env.example infrastructure/docker/.env
```

Required environment variables:
- `OPENROUTER_API_KEY` - For LLM access
- `CLERK_SECRET_KEY` - For authentication
- `DB_PASSWORD` - PostgreSQL password

## Development Workflow

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

### Branch Naming Convention

- `feature/team{N}/{description}` - New features
- `fix/team{N}/{description}` - Bug fixes
- `refactor/team{N}/{description}` - Refactoring

### Pull Request Requirements

1. All tests pass
2. Contract tests pass (if touching APIs)
3. Code review by 1+ team member
4. No breaking changes to shared packages without RFC

## API Contracts

All inter-service APIs are defined in `contracts/openapi/`:

- `agents-service.yaml` - Agent Service API
- `rag-service.yaml` - RAG Service API
- `rbac-service.yaml` - RBAC Service API

Events are defined in `contracts/events/`:

- `agent-events.json` - Agent lifecycle events
- `processing-events.json` - Processing events

## Database Schema

PostgreSQL with schema isolation per domain:

```sql
CREATE SCHEMA audio;    -- Audio files, transcripts
CREATE SCHEMA agents;   -- Agent registry, identity cards
CREATE SCHEMA rag;      -- Embeddings, vector metadata
CREATE SCHEMA auth;     -- Users, roles, permissions
```

## MCP Integration

MCP (Model Context Protocol) servers expose tools for:

- **Database MCP**: CRUD operations on all entities
- **Teams MCP**: Send/receive Teams messages
- **Slack MCP**: Send/receive Slack messages
- **GitHub MCP**: Repository operations

## Contributing

1. Create a feature branch from `develop`
2. Make changes following team guidelines
3. Write/update tests
4. Submit PR with description
5. Address review comments
6. Merge after approval

## Support

- **Issues**: https://github.com/your-org/audio-insight/issues
- **Documentation**: `/docs` directory
- **Team Channels**: Check internal communication tools
