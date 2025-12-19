# Intellibooks Studio

AI-Powered Document Intelligence Platform with RAG, Agents, and MCP integration.

## Features

- **Audio Transcription** - Convert audio files to text using OpenAI Whisper
- **Translation** - Translate transcripts to 30+ languages
- **Summarization** - Generate summaries with key points and action items
- **Intent Detection** - Classify content into categories
- **Keyword Extraction** - Extract keywords, keyphrases, and named entities
- **RAG Pipeline** - Semantic search with Ray distributed processing & RabbitMQ queuing
- **Multi-Provider LLM** - OpenAI, Anthropic, OpenRouter support
- **MCP Integration** - Database, Teams, Slack, GitHub MCP servers

## Architecture

```
┌─────────────┐     REST/WS     ┌─────────────┐
│  NextJS UI  │<--------------->│ API Gateway │
│             │                 │             │
└─────────────┘                 └──────┬──────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        v                              v                              v
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ Agent Service │           │  RAG Service  │           │ RBAC Service  │
│  (Port 8001)  │           │  (Port 8002)  │           │  (Port 8003)  │
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

## Project Structure

```
intellibooks-studio/
├── packages/                     # Shared libraries
│   ├── core/                     # Types, schemas, utilities
│   ├── agent-framework/          # Agent Identity Cards, DNA Blueprint
│   └── auth/                     # Clerk, RBAC middleware
├── apps/
│   ├── ui/                       # NextJS 16 application
│   └── api-gateway/              # Central API gateway
├── services/
│   ├── agents/                   # Agent service (Python/FastAPI)
│   ├── rag/                      # RAG pipeline (Python/FastAPI)
│   ├── rbac/                     # RBAC service (Node/Express)
│   └── websocket/                # WebSocket service
├── mcp-servers/
│   ├── database-mcp/             # Database operations
│   ├── github-mcp/               # GitHub integration
│   ├── slack-mcp/                # Slack integration
│   ├── teams-mcp/                # MS Teams integration
│   └── mcp-registry/             # MCP server discovery
├── infrastructure/               # Docker Compose, configs
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml           # PNPM workspaces
└── pyproject.toml                # Python monorepo config
```

## Tech Stack

### Backend
- **Python 3.10+** - FastAPI, LangChain, LangGraph
- **Node.js 18+** - Express, TypeScript
- **Whisper** - Audio transcription
- **ChromaDB** - Vector database
- **Ray** - Distributed processing (Docker-based on Windows)
- **RabbitMQ** - Message queue
- **PostgreSQL** - Primary database
- **Redis** - Caching and pub/sub

### Frontend
- **Next.js 16** - React framework
- **Tailwind CSS** - Styling
- **Clerk** - Authentication
- **React Query** - Data fetching

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | [python.org](https://python.org/) |
| **pnpm** | 8+ | `npm install -g pnpm` |
| **Docker** | Latest | [docker.com](https://docker.com/) |
| **FFmpeg** | Latest | Required for audio processing |
| **Tesseract OCR** | 5.x | Required for scanned PDF OCR |
| **Poppler** | Latest | Required for PDF to image conversion |

### Installing FFmpeg

**Windows (with winget):**
```powershell
winget install FFmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install ffmpeg
```

### Installing Tesseract OCR (Required for Scanned PDF Support)

Tesseract OCR is required to extract text from scanned/image-based PDFs.

**Windows (with winget):**
```powershell
winget install UB-Mannheim.TesseractOCR
```

After installation, Tesseract should be available at:
- `C:\Program Files\Tesseract-OCR\tesseract.exe`

**macOS:**
```bash
brew install tesseract
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install tesseract-ocr
```

### Installing Poppler (Required for Scanned PDF Support)

Poppler provides the `pdftoppm` utility needed to convert PDF pages to images for OCR.

**Windows (with winget):**
```powershell
winget install poppler
```

After installation, Poppler binaries should be available at one of these locations:
- `C:\Users\<username>\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_...\poppler-X.XX.X\Library\bin`
- `C:\Program Files\poppler\Library\bin`
- `C:\Program Files\poppler\bin`

**macOS:**
```bash
brew install poppler
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install poppler-utils
```

> **Note:** After installing Tesseract and Poppler on Windows, you may need to restart your terminal/PowerShell for the PATH changes to take effect. The RAG service will automatically detect these tools at their default installation paths.

---

## Quick Start Guide

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/intellibooks/intellibooks-studio.git
cd intellibooks-studio

# Install JavaScript dependencies
pnpm install

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

# Install Python dependencies
pip install -e ".[dev]"
```

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# LLM Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
DEFAULT_LLM_PROVIDER=openrouter

# Whisper Configuration (tiny, base, small, medium, large)
WHISPER_MODEL=base

# ChromaDB (Docker)
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Ray (Docker-based, required for Windows)
USE_RAY=true
RAY_ADDRESS=ray://localhost:10001

# RabbitMQ
USE_RABBITMQ=true
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=devpassword123

# Authentication (Clerk)
CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
CLERK_SECRET_KEY=sk_test_your-clerk-secret
```

### Step 3: Start Infrastructure Services

```bash
cd infrastructure/docker

# Start core infrastructure
docker-compose up -d chroma rabbitmq redis postgres

# (Optional) Start Ray cluster for distributed processing
docker-compose --profile ray up -d

# Verify services are running
docker-compose ps
```

### Step 4: Run the Application

```bash
# Run all services at once (recommended)
pnpm dev:all
```

Or run services individually:

```bash
# Terminal 1 - Agent Service (Port 8001)
pnpm dev:agents

# Terminal 2 - RAG Service (Port 8002)
pnpm dev:rag

# Terminal 3 - UI (Port 3001)
pnpm dev:ui
```

### Step 5: Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **UI** | http://localhost:3001 | Main web interface |
| **Agent Service** | http://localhost:8001/docs | Agent API (Swagger UI) |
| **RAG Service** | http://localhost:8002/docs | RAG API (Swagger UI) |
| **ChromaDB** | http://localhost:8000 | Vector database |
| **RabbitMQ Management** | http://localhost:15672 | Message queue UI (admin/devpassword123) |
| **Ray Dashboard** | http://localhost:8265 | Distributed processing UI |

---

## Docker Services

### Start All Infrastructure
```bash
cd infrastructure/docker

# Core services
docker-compose up -d chroma rabbitmq redis postgres

# With Ray cluster
docker-compose --profile ray up -d

# With development tools (Adminer, Redis Commander)
docker-compose --profile tools up -d
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & pub/sub |
| ChromaDB | 8000 | Vector database |
| RabbitMQ | 5672 | Message queue |
| RabbitMQ UI | 15672 | Management interface |
| Ray Dashboard | 8265 | Distributed processing UI |
| Ray Client | 10001 | Ray client connection |
| Adminer | 8080 | Database admin (tools profile) |

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

### RAG Service (Port 8002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/ingest` | POST | Ingest documents |
| `/api/query` | POST | Query with RAG |
| `/api/search` | POST | Semantic search |
| `/api/stats` | GET | Pipeline statistics |
| `/api/documents/:id` | DELETE | Delete document |

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

## Development

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

### Building

```bash
pnpm build
```

---

## Troubleshooting

### Common Issues

**1. FFmpeg not found**
```
Error: FFmpeg not found. Please install FFmpeg.
```
Solution: Install FFmpeg and ensure it's in your PATH. Run `ffmpeg -version` to verify.

**2. ChromaDB connection failed**
```
Error: Could not connect to Chroma at localhost:8000
```
Solution: Start the Chroma container:
```bash
cd infrastructure/docker
docker-compose up -d chroma
```

**3. Ray connection failed (Windows)**
```
Error: Could not connect to Ray cluster
```
Solution: Ray doesn't work with venv on Windows. Start the Docker Ray cluster:
```bash
cd infrastructure/docker
docker-compose --profile ray up -d
```

**4. RabbitMQ connection failed**
```
Error: Connection refused to RabbitMQ
```
Solution: Start RabbitMQ:
```bash
cd infrastructure/docker
docker-compose up -d rabbitmq
```

**5. Scanned PDF OCR failed - Tesseract not found**
```
Error: tesseract is not installed or it's not in your PATH
```
Solution: Install Tesseract OCR:
```powershell
# Windows
winget install UB-Mannheim.TesseractOCR

# macOS
brew install tesseract

# Linux
sudo apt install tesseract-ocr
```

**6. Scanned PDF OCR failed - Poppler not found**
```
Error: Unable to get page count. Is poppler installed and in PATH?
```
Solution: Install Poppler:
```powershell
# Windows
winget install poppler

# macOS
brew install poppler

# Linux
sudo apt install poppler-utils
```
After installation on Windows, restart your terminal for PATH changes to take effect.

**7. Port already in use**
```
Error: Port 8001 is already in use
```
Solution: Kill the process or use a different port:
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
docker-compose -f infrastructure/docker/docker-compose.yml logs -f chroma
docker-compose -f infrastructure/docker/docker-compose.yml logs -f rabbitmq
```

### Resetting the Environment

```bash
# Stop all containers
docker-compose -f infrastructure/docker/docker-compose.yml down

# Remove volumes (WARNING: deletes all data)
docker-compose -f infrastructure/docker/docker-compose.yml down -v

# Start fresh
docker-compose -f infrastructure/docker/docker-compose.yml up -d chroma rabbitmq redis postgres
```

---

## Contributing

1. Fork the repository
2. Create a feature branch from `main`
3. Make changes following coding standards
4. Write/update tests
5. Submit PR with description
6. Address review comments
7. Merge after approval

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: [Report a bug](https://github.com/intellibooks/intellibooks-studio/issues)
- Documentation: [Wiki](https://github.com/intellibooks/intellibooks-studio/wiki)
