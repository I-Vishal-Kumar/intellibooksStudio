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

---

## Prerequisites

Before running the application, ensure you have the following installed:

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.11+ | [python.org](https://python.org/) |
| **pnpm** | 8+ | `npm install -g pnpm` |
| **Docker** | Latest | [docker.com](https://docker.com/) |
| **Docker Compose** | Latest | Included with Docker Desktop |
| **FFmpeg** | Latest | Required for audio processing |

### Installing FFmpeg

**Windows (with winget):**
```powershell
winget install FFmpeg
```

**Windows (with Chocolatey):**
```powershell
choco install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install ffmpeg
```

---

## Quick Start Guide

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd audio-transcription

# Install JavaScript dependencies
pnpm install

# Install Python dependencies (choose one)
pip install -e ".[dev]"          # Using pip
# OR
uv sync                           # Using uv (faster)
```

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
copy infrastructure\docker\.env.example infrastructure\docker\.env
```

Edit `infrastructure/docker/.env` with your API keys:

```env
# ===========================================
# Database Configuration
# ===========================================
DB_PASSWORD=devpassword123

# ===========================================
# LLM Providers (at least one required)
# ===========================================
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key

# Default provider: openai, anthropic, or openrouter
DEFAULT_LLM_PROVIDER=openrouter

# ===========================================
# Whisper Configuration
# ===========================================
# Options: tiny, base, small, medium, large
WHISPER_MODEL=base

# ===========================================
# Authentication (Clerk)
# ===========================================
CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret

# ===========================================
# Optional: Integration Tokens
# ===========================================
GITHUB_TOKEN=ghp_your-github-token
SLACK_BOT_TOKEN=xoxb-your-slack-token
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
```

### Step 3: Start Infrastructure Services

Start the required infrastructure (PostgreSQL, Redis, Chroma):

```bash
# Start infrastructure only (recommended for development)
docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres redis chroma

# Verify services are running
docker-compose -f infrastructure/docker/docker-compose.yml ps
```

Expected output:
```
NAME                        STATUS
audio-insight-postgres      running (healthy)
audio-insight-redis         running (healthy)
audio-insight-chroma        running (healthy)
```

### Step 4: Run the Application

You have three options to run the application:

#### Option A: Run All Services at Once (Recommended)

The simplest way to start all services with a single command:

```bash
pnpm dev:all
```

This runs the UI (port 3000), Agent Service (port 8001), and RAG Service (port 8002) concurrently with color-coded output.

#### Option B: Run Services Individually

Open separate terminal windows for each service:

**Terminal 1 - Agent Service (Port 8001):**
```bash
pnpm dev:agents
# Or manually:
cd services/agents
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 - RAG Service (Port 8002):**
```bash
pnpm dev:rag
# Or manually:
cd services/rag
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8002
```

**Terminal 3 - UI (Port 3000):**
```bash
pnpm dev:ui
# Or manually:
cd apps/ui
pnpm dev
```

#### Option C: Run All Services with Docker Compose

```bash
# Start everything including application services
docker-compose -f infrastructure/docker/docker-compose.yml --profile full up -d

# View logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f
```

### Step 5: Access the Application

Once all services are running, open your browser:

| Service | URL | Description |
|---------|-----|-------------|
| **UI** | http://localhost:3001 | Main web interface |
| **Agent Service** | http://localhost:8001/docs | Agent API (Swagger UI) |
| **RAG Service** | http://localhost:8002/docs | RAG API (Swagger UI) |
| **RBAC Service** | http://localhost:8003/api/health | RBAC health check |
| **Chroma** | http://localhost:8000 | Vector database |
| **Adminer** | http://localhost:8080 | Database admin (with tools profile) |

---

## Running Individual Components

### Agent Service Only

```bash
cd services/agents

# Create virtual environment (optional but recommended)
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Set environment variables
set OPENROUTER_API_KEY=your-key  # Windows
export OPENROUTER_API_KEY=your-key  # Linux/macOS

# Run the service
uvicorn src.api.main:app --reload --port 8001
```

### RAG Service Only

```bash
cd services/rag

# Install dependencies
pip install -r requirements.txt

# Ensure Chroma is running
docker-compose -f ../../infrastructure/docker/docker-compose.yml up -d chroma

# Run the service
uvicorn src.api.main:app --reload --port 8002
```

### RBAC Service Only

```bash
cd services/rbac

# Install dependencies
pnpm install

# Set environment variables
set CLERK_SECRET_KEY=your-key
set DATABASE_URL=postgresql://admin:devpassword123@localhost:5432/audio_insight

# Run the service
pnpm dev
```

### UI Only

```bash
cd apps/ui

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

---

## Using the Application

### 1. Upload and Process Audio

**Via UI:**
1. Open http://localhost:3001
2. Drag & drop an audio file or click to select
3. Choose processing options (transcribe, translate, summarize, etc.)
4. Click "Process" and wait for results

**Via API:**
```bash
# Upload audio file
curl -X POST http://localhost:8001/api/upload \
  -F "file=@your-audio.mp3"

# Process with all tasks
curl -X POST http://localhost:8001/api/agents/process \
  -H "Content-Type: application/json" \
  -d '{
    "audio_file_id": "returned-file-id",
    "tasks": ["transcribe", "summarize", "detect_intent", "extract_keywords"],
    "options": {
      "target_languages": ["es", "fr"]
    }
  }'
```

### 2. Analyze Text Directly

```bash
curl -X POST http://localhost:8001/api/agents/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your text to analyze here...",
    "tasks": ["summarize", "detect_intent", "extract_keywords"]
  }'
```

### 3. Query the Knowledge Base (RAG)

```bash
# Index a document
curl -X POST http://localhost:8002/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_id": "transcript-123",
    "text": "Document content...",
    "metadata": {"source": "audio-file.mp3"}
  }'

# Query the knowledge base
curl -X POST http://localhost:8002/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What was discussed about the project timeline?",
    "top_k": 5
  }'
```

---

## Development Workflow

### Git Branching Strategy

```
main (protected)
  └── develop (integration)
        ├── feature/team1/*  (UI)
        ├── feature/team2/*  (RAG)
        ├── feature/team3/*  (Agents)
        ├── feature/team4/*  (RBAC)
        └── feature/team5/*  (MCP)
```

### Running Tests

```bash
# JavaScript tests
pnpm test

# Python tests
pytest services/agents/tests -v
pytest services/rag/tests -v

# Test with coverage
pytest --cov=services/agents/src services/agents/tests
```

### Code Formatting

```bash
# JavaScript/TypeScript
pnpm lint
pnpm lint:fix

# Python
black services/ packages/
ruff check services/ packages/ --fix
```

---

## API Reference

### Agent Service (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/upload` | POST | Upload audio file |
| `/api/agents/process` | POST | Process audio with agents |
| `/api/agents/analyze-text` | POST | Analyze text directly |
| `/api/agents/registry` | GET | List registered agents |
| `/api/agents/{id}/identity` | GET | Get agent identity card |

### RAG Service (Port 8002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/rag/index` | POST | Index document |
| `/api/rag/query` | POST | Query with RAG |
| `/api/rag/search` | POST | Semantic search |

### RBAC Service (Port 8003)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/verify` | POST | Verify token |
| `/api/auth/authorize` | POST | Check authorization |
| `/api/users/me` | GET | Get current user |
| `/api/users` | GET | List users |
| `/api/roles` | GET | List roles |

---

## Troubleshooting

### Common Issues

**1. FFmpeg not found**
```
Error: FFmpeg not found. Please install FFmpeg.
```
Solution: Install FFmpeg and ensure it's in your PATH. Run `ffmpeg -version` to verify.

**2. Database connection failed**
```
Error: Connection to PostgreSQL failed
```
Solution: Ensure Docker is running and the postgres container is healthy:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres
docker-compose -f infrastructure/docker/docker-compose.yml ps
```

**3. Chroma connection failed**
```
Error: Could not connect to Chroma at localhost:8000
```
Solution: Start the Chroma container:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d chroma
```

**4. API key errors**
```
Error: Invalid API key
```
Solution: Verify your API keys in `.env` file and ensure they're exported:
```bash
# Windows
set OPENROUTER_API_KEY=your-key

# Linux/macOS
export OPENROUTER_API_KEY=your-key
```

**5. Port already in use**
```
Error: Port 8001 is already in use
```
Solution: Kill the process using the port or use a different port:
```bash
# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8001
kill -9 <PID>
```

### Viewing Logs

```bash
# Docker container logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f

# Specific service logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f postgres
docker-compose -f infrastructure/docker/docker-compose.yml logs -f chroma
```

### Resetting the Environment

```bash
# Stop all containers
docker-compose -f infrastructure/docker/docker-compose.yml down

# Remove volumes (WARNING: deletes all data)
docker-compose -f infrastructure/docker/docker-compose.yml down -v

# Start fresh
docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres redis chroma
```

---

## Documentation

- [Architecture Guide](docs/architecture/README.md)
- [API Contracts](contracts/openapi/)
- [Agent Framework](packages/agent-framework/)

## Contributing

1. Create a feature branch from `develop`
2. Make changes following team guidelines
3. Write/update tests
4. Submit PR with description
5. Address review comments
6. Merge after approval

## License

MIT License
