# Intellibooks Studio

A powerful AI-powered enterprise platform with multi-service integrations.

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git (to clone the repository)

### Step 1: Clone and Navigate

```bash
git clone <repository-url>
cd IntelliBooksStudio
```

### Step 2: Set Up Environment

Copy the example environment file:

```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required - Choose at least one LLM provider
OPENROUTER_API_KEY=your-openrouter-key

# Optional - For OAuth integrations (see below)
NEXT_PUBLIC_NANGO_PUBLIC_KEY=your-nango-public-key
```

### Step 3: Run Everything

```bash
# Navigate to docker folder
cd infrastructure/docker

# Start all services
docker-compose --profile app up -d --build
```

That's it! Wait a few minutes for everything to build and start.

### Step 4: Access the Application

Open your browser and go to:

- **Main App**: http://localhost:3000
- **API Docs**: http://localhost:8002/docs

---

## Setting Up OAuth Integrations (Optional)

This project uses **Nango** to handle OAuth connections (Google, Zoom, Slack, etc.). With Nango, your users can simply click "Connect" and log in - no API keys needed for them!

### Why Nango?

- Free tier available (up to 3 integrations)
- Users just click "Connect" and authorize - like Pipedream
- Handles token refresh automatically
- Supports 500+ services

### Setup Steps

1. **Sign up at [nango.dev](https://nango.dev)** (free)

2. **Get your keys** from the Nango dashboard:
   - Public Key (for frontend)
   - Secret Key (for backend)

3. **Add to your `.env` file**:
   ```env
   NEXT_PUBLIC_NANGO_PUBLIC_KEY=your-public-key
   NANGO_SECRET_KEY=your-secret-key
   ```

4. **Configure integrations in Nango**:
   - Go to Nango dashboard > Integrations
   - Enable: Google, Zoom, Slack, etc.
   - For each, add your OAuth credentials (from Google Cloud Console, Zoom Marketplace, etc.)

5. **Restart the app**:
   ```bash
   docker-compose --profile app down
   docker-compose --profile app up -d --build
   ```

Now users can connect their accounts from the Settings > Integrations page!

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| UI (Frontend) | 3000 | http://localhost:3000 |
| RAG Service | 8002 | http://localhost:8002 |
| WebSocket | 8004 | http://localhost:8004 |
| MCP Gateway | 8005 | http://localhost:8005 |
| PostgreSQL | 5433 | localhost:5433 |
| Redis | 6379 | localhost:6379 |
| ChromaDB | 8000 | http://localhost:8000 |
| Neo4j | 7474/7687 | http://localhost:7474 |
| RabbitMQ | 15672 | http://localhost:15672 |

---

## Common Commands

### Start Services
```bash
cd infrastructure/docker
docker-compose --profile app up -d --build
```

### Stop Services
```bash
docker-compose --profile app down
```

### View Logs
```bash
# All services
docker-compose --profile app logs -f

# Specific service
docker-compose logs -f ui
docker-compose logs -f rag-service
```

### Rebuild After Changes
```bash
docker-compose --profile app up -d --build
```

### Reset Everything (Clean Start)
```bash
docker-compose --profile app down -v
docker-compose --profile app up -d --build
```

---

## Local Development (With Hot Reload)

For development with real-time code changes, use `pnpm dev:all` to run everything at once.

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Python 3.10+

### Quick Start (Recommended)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (databases)
cd infrastructure/docker
docker-compose up -d
cd ../..

# 3. Run all services with hot reload
pnpm dev:all
```

This runs UI, WebSocket, Agents, and RAG services concurrently with color-coded logs.

### Individual Services

Run specific services if needed:

```bash
# Frontend only
pnpm dev:ui

# WebSocket service only
pnpm dev:ws

# RAG service only
pnpm dev:rag

# Agents service only
pnpm dev:agents
```

### Manual Python Services (Alternative)

If you prefer running Python services manually:

```bash
# RAG Service
cd services/rag
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8002

# WebSocket Service
cd services/websocket
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8004
```

---

## Troubleshooting

### Docker build fails with "path not found"
Make sure you're in the `infrastructure/docker` folder:
```bash
cd infrastructure/docker
docker-compose --profile app up -d --build
```

### Port already in use
Stop any existing services or change ports in `docker-compose.yml`.

### Services not connecting
Wait 1-2 minutes for all services to start. Check logs:
```bash
docker-compose --profile app logs -f
```

### OAuth not working
1. Check that `NEXT_PUBLIC_NANGO_PUBLIC_KEY` is set in `.env`
2. Verify integrations are configured in Nango dashboard
3. Restart: `docker-compose --profile app restart ui`

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                        Frontend (UI)                         |
|                    Next.js @ port 3000                       |
+----------------------------+--------------------------------+
                             |
           +-----------------+-----------------+
           v                 v                 v
    +-----------+     +-----------+     +-----------+
    |    RAG    |     | WebSocket |     |    MCP    |
    |  Service  |     |  Service  |     |  Gateway  |
    |   :8002   |     |   :8004   |     |   :8005   |
    +-----+-----+     +-----+-----+     +-----+-----+
          |                 |                 |
          +-----------------+-----------------+
                            v
        +------------------------------------+
        |         Infrastructure             |
        |  PostgreSQL, Redis, ChromaDB,      |
        |  Neo4j, RabbitMQ                   |
        +------------------------------------+
```

---

## Need Help?

- Check the logs: `docker-compose --profile app logs -f`
- Restart services: `docker-compose --profile app restart`
- Clean rebuild: `docker-compose --profile app down -v && docker-compose --profile app up -d --build`
