# Intellibooks Studio - System Architecture

## Executive Summary

This document defines a **simple, practical, and scalable** architecture for the Intellibooks AI platform, building on top of what's already implemented. The design prioritizes:

- **Modularity** - Each service is independent and replaceable
- **MCP-First Communication** - All services communicate via Model Context Protocol
- **Parallel Execution** - RAG, Knowledge Graph, and Agents run independently
- **GCP Simplicity** - Cloud Run over Kubernetes, minimal DevOps overhead

---

## 1. What You Already Have (Don't Touch)

### Working Services
```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   UI (3001)  │  │ Agents(8001) │  │  RAG (8002)  │          │
│  │   Next.js    │  │   FastAPI    │  │   FastAPI    │          │
│  │   React 19   │  │  LangChain   │  │  ChromaDB    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ RBAC (8003)  │  │WebSocket(8004│                            │
│  │   Express    │  │   FastAPI    │                            │
│  │    Clerk     │  │  Real-time   │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATABASES                             │   │
│  │  PostgreSQL │ Redis │ ChromaDB │ Neo4j │ RabbitMQ │ Ray │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MCP SERVERS                           │   │
│  │  database-mcp │ github-mcp │ slack-mcp │ teams-mcp      │   │
│  │               mcp-registry                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Keep These As-Is
- All 12 agents (Transcription, Translation, Chat, Research, Analytics, etc.)
- RAG pipeline with ChromaDB + Neo4j
- WebSocket real-time communication
- RBAC with Clerk authentication
- Existing MCP servers (database, github, slack, teams, registry)

---

## 2. Target Architecture (MCP-First)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                              USERS                                         │
│                                │                                           │
│                                ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                         API GATEWAY                                   │ │
│  │                    (Cloud Run / Nginx)                                │ │
│  │         Routes: /api/*, /ws/*, /mcp/*                                │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                │                                           │
│          ┌────────────────────┼────────────────────┐                      │
│          │                    │                    │                      │
│          ▼                    ▼                    ▼                      │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐               │
│  │   UI Service  │   │   WebSocket   │   │  MCP Gateway  │               │
│  │   (Next.js)   │   │   Service     │   │   Service     │               │
│  │   Cloud Run   │   │   Cloud Run   │   │   Cloud Run   │               │
│  └───────────────┘   └───────────────┘   └───────────────┘               │
│                                                  │                        │
│                                                  ▼                        │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │                        MCP BUS (Message Router)                       ││
│  │                                                                       ││
│  │   All services communicate ONLY through MCP protocol                 ││
│  │   Uses: Redis Pub/Sub OR Cloud Pub/Sub for message routing           ││
│  │                                                                       ││
│  └──────────────────────────────────────────────────────────────────────┘│
│          │              │              │              │                   │
│          ▼              ▼              ▼              ▼                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │   Agent     │ │    RAG      │ │  Knowledge  │ │    RBAC     │         │
│  │   Service   │ │   Service   │ │   Graph     │ │   Service   │         │
│  │  Cloud Run  │ │  Cloud Run  │ │  Cloud Run  │ │  Cloud Run  │         │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│          │              │              │              │                   │
│          └──────────────┴──────────────┴──────────────┘                   │
│                                │                                          │
│                                ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │                     MCP INTEGRATION LAYER                             ││
│  │                                                                       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        ││
│  │  │ Gmail   │ │ Slack   │ │ GitHub  │ │ClickUp │ │  Zoom   │        ││
│  │  │  MCP    │ │  MCP    │ │  MCP    │ │  MCP    │ │  MCP    │        ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        ││
│  │                                                                       ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        ││
│  │  │  Zoho   │ │ Teams   │ │  Drive  │ │  Azure  │ │   ERP   │        ││
│  │  │  MCP    │ │  MCP    │ │  MCP    │ │ DevOps  │ │  MCP    │        ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                │                                          │
│                                ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │                         DATA LAYER                                    ││
│  │                                                                       ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐         ││
│  │  │PostgreSQL │  │  Redis    │  │ ChromaDB  │  │   Neo4j   │         ││
│  │  │Cloud SQL  │  │ Memorystore│ │  (GCE)    │  │  (GCE)    │         ││
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘         ││
│  │                                                                       ││
│  │  ┌───────────┐  ┌───────────┐                                        ││
│  │  │Cloud      │  │ Cloud     │                                        ││
│  │  │Storage    │  │ Pub/Sub   │                                        ││
│  │  └───────────┘  └───────────┘                                        ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Service Breakdown

### Core Services (Your Existing Code)

| Service | Current Port | GCP Deployment | Docker Image | Notes |
|---------|--------------|----------------|--------------|-------|
| UI | 3001 | Cloud Run | `intellibooks-ui` | Keep as-is |
| Agent Service | 8001 | Cloud Run | `intellibooks-agents` | Keep as-is |
| RAG Service | 8002 | Cloud Run | `intellibooks-rag` | Keep as-is |
| RBAC Service | 8003 | Cloud Run | `intellibooks-rbac` | Keep as-is |
| WebSocket | 8004 | Cloud Run | `intellibooks-ws` | Keep as-is |

### New Services to Build

| Service | Purpose | GCP Deployment | Priority |
|---------|---------|----------------|----------|
| MCP Gateway | Routes MCP calls to services | Cloud Run | HIGH |
| Context Aggregator | Pulls 24hr context from all integrations | Cloud Run | HIGH |
| Agent Factory | Creates dynamic agents on demand | Cloud Run | MEDIUM |

### MCP Servers (Integration Adapters)

| MCP Server | Status | Purpose |
|------------|--------|---------|
| database-mcp | DONE | PostgreSQL queries |
| github-mcp | DONE | GitHub issues, PRs |
| slack-mcp | DONE | Slack messages |
| teams-mcp | DONE | MS Teams messages |
| mcp-registry | DONE | Service discovery |
| gmail-mcp | TODO | Gmail read/send |
| zoho-mail-mcp | TODO | Zoho Mail |
| zoho-cliq-mcp | TODO | Zoho Cliq chat |
| drive-mcp | TODO | Google Drive docs |
| clickup-mcp | TODO | ClickUp tasks |
| azure-devops-mcp | TODO | Azure DevOps work items |
| zoom-mcp | TODO | Zoom meetings |
| erp-mcp | TODO | ERP system queries |
| neo4j-mcp | TODO | Knowledge graph queries |
| chromadb-mcp | TODO | Vector search |

---

## 4. MCP Communication Design

### MCP Message Format
```typescript
interface MCPRequest {
  id: string;
  method: 'tools/call' | 'resources/read' | 'tools/list';
  params: {
    name: string;        // Tool or resource name
    arguments?: object;  // Tool arguments
  };
  metadata: {
    source: string;      // Calling service
    sessionId?: string;  // User session
    traceId: string;     // For distributed tracing
  };
}

interface MCPResponse {
  id: string;
  result?: {
    content: Array<{type: string; text: string}>;
  };
  error?: {
    code: number;
    message: string;
  };
}
```

### Service Discovery Flow
```
┌──────────────┐    1. Register     ┌──────────────┐
│  New Service │ ───────────────▶  │ MCP Registry │
└──────────────┘                    └──────────────┘
                                           │
                                    2. Stored in registry
                                           │
┌──────────────┐    3. Lookup tool  ┌──────────────┐
│ Agent Service│ ───────────────▶  │ MCP Registry │
└──────────────┘                    └──────────────┘
       │                                   │
       │                    4. Returns endpoint
       │                                   │
       │         5. Direct MCP call        ▼
       └─────────────────────────▶ ┌──────────────┐
                                   │  slack-mcp   │
                                   └──────────────┘
```

### MCP Gateway (New Service)

The MCP Gateway acts as a unified entry point for all MCP operations:

```typescript
// services/mcp-gateway/src/index.ts
interface MCPGateway {
  // Route MCP calls to appropriate servers
  route(request: MCPRequest): Promise<MCPResponse>;

  // Health check all registered MCP servers
  healthCheck(): Promise<HealthStatus[]>;

  // Aggregate tools from all servers
  listAllTools(): Promise<Tool[]>;

  // Execute tool with automatic routing
  callTool(toolName: string, args: object): Promise<MCPResponse>;
}
```

---

## 5. Agent Architecture

### Current Agent Structure (Keep)
```
packages/agent-framework/
├── base/agent.py           # BaseAgent class
├── identity/card.py        # AgentIdentityCard
├── dna/blueprint.py        # AgentDNABlueprint
└── registry/agent_registry.py

services/agents/src/agents/
├── transcription_agent.py  # Whisper-based
├── translation_agent.py    # Multi-language
├── summarization_agent.py  # LLM-based
├── chat_agent.py           # Conversational
├── research_agent.py       # Information retrieval
├── analytics_agent.py      # Database analytics
└── ... (7 more agents)
```

### Dynamic Agent Creation (New)

Add an Agent Factory service that creates agents on-demand:

```python
# services/agent-factory/src/factory.py
class AgentFactory:
    """Creates agents dynamically based on user prompts"""

    async def create_agent(
        self,
        name: str,
        description: str,
        capabilities: List[str],
        tools: List[str],  # MCP tools this agent can use
        llm_config: dict
    ) -> DynamicAgent:
        """
        Creates a new agent with specified capabilities.
        The agent is registered in the agent registry and
        can immediately start handling tasks.
        """
        identity = AgentIdentityCard(
            agent_id=str(uuid4()),
            name=name,
            description=description,
            skills=[Skill(name=cap) for cap in capabilities],
            trust_level=TrustLevel.BASIC
        )

        agent = DynamicAgent(
            identity=identity,
            tools=tools,
            llm_config=llm_config
        )

        await self.registry.register(agent)
        return agent
```

### Agent Execution Flow
```
User Prompt
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                    Smart Handler                         │
│  1. Parse intent                                        │
│  2. Check existing agents                               │
│  3. If no suitable agent → call Agent Factory           │
│  4. Route to appropriate agent                          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                    Agent Execution                       │
│  1. Agent receives task                                 │
│  2. Queries MCP Registry for required tools             │
│  3. Calls MCP servers (Gmail, Slack, DB, etc.)          │
│  4. Aggregates results                                  │
│  5. Uses LLM to reason and respond                      │
│  6. Returns result to user                              │
└─────────────────────────────────────────────────────────┘
```

---

## 6. RAG & Knowledge Graph Architecture

### Current Setup (Keep)
```
┌─────────────────────────────────────────────────────────┐
│                    RAG Service (8002)                    │
│                                                          │
│  Document Upload → Chunking → Embedding → ChromaDB      │
│                         │                                │
│                         └──→ Entity Extraction → Neo4j  │
│                                                          │
│  Query → Semantic Search → LLM Generation → Response    │
└─────────────────────────────────────────────────────────┘
```

### Enhanced Architecture (MCP-Enabled)
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────────────────┐      ┌──────────────────┐                     │
│  │   RAG Service    │      │ Knowledge Graph  │                     │
│  │                  │      │    Service       │                     │
│  │  - Chunking      │      │                  │                     │
│  │  - Embedding     │      │  - Entity Store  │                     │
│  │  - Semantic      │      │  - Relationship  │                     │
│  │    Search        │      │  - Path Finding  │                     │
│  │                  │      │                  │                     │
│  └────────┬─────────┘      └────────┬─────────┘                     │
│           │                         │                                │
│           │      MCP Protocol       │                                │
│           ▼                         ▼                                │
│  ┌──────────────────┐      ┌──────────────────┐                     │
│  │  chromadb-mcp    │      │    neo4j-mcp     │                     │
│  │                  │      │                  │                     │
│  │  Tools:          │      │  Tools:          │                     │
│  │  - search        │      │  - query_graph   │                     │
│  │  - add_documents │      │  - find_entities │                     │
│  │  - delete        │      │  - find_paths    │                     │
│  │  - get_stats     │      │  - add_entity    │                     │
│  └────────┬─────────┘      └────────┬─────────┘                     │
│           │                         │                                │
│           ▼                         ▼                                │
│  ┌──────────────────┐      ┌──────────────────┐                     │
│  │    ChromaDB      │      │      Neo4j       │                     │
│  │  (Vector Store)  │      │  (Graph Store)   │                     │
│  └──────────────────┘      └──────────────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Parallel Execution Pattern
```python
# Both RAG and Knowledge Graph can be queried in parallel
async def hybrid_search(query: str, session_id: str):
    # Run both searches in parallel
    vector_results, graph_results = await asyncio.gather(
        mcp_call("chromadb-mcp", "search", {"query": query}),
        mcp_call("neo4j-mcp", "find_entities", {"query": query})
    )

    # Merge and rank results
    merged = merge_results(vector_results, graph_results)

    # Use LLM to synthesize final answer
    return await generate_response(query, merged)
```

---

## 7. Studio Context Aggregation

### 24-Hour Context Pull (New Feature)

When user opens `/studio`, automatically pull context:

```python
# services/context-aggregator/src/aggregator.py
class ContextAggregator:
    """Pulls last 24 hours of context from all connected services"""

    async def get_daily_context(self, user_id: str) -> DailyContext:
        # Pull from all MCP servers in parallel
        results = await asyncio.gather(
            self.get_emails(user_id),      # gmail-mcp, zoho-mail-mcp
            self.get_chats(user_id),        # slack-mcp, teams-mcp, zoho-cliq-mcp
            self.get_documents(user_id),    # drive-mcp
            self.get_tasks(user_id),        # clickup-mcp, azure-devops-mcp
            self.get_meetings(user_id),     # zoom-mcp
            self.get_erp_updates(user_id),  # erp-mcp
            return_exceptions=True
        )

        return DailyContext(
            emails=results[0] if not isinstance(results[0], Exception) else [],
            chats=results[1] if not isinstance(results[1], Exception) else [],
            documents=results[2] if not isinstance(results[2], Exception) else [],
            tasks=results[3] if not isinstance(results[3], Exception) else [],
            meetings=results[4] if not isinstance(results[4], Exception) else [],
            erp_updates=results[5] if not isinstance(results[5], Exception) else [],
        )

    async def get_emails(self, user_id: str) -> List[Email]:
        """Fetch emails from last 24 hours"""
        since = datetime.now() - timedelta(hours=24)

        gmail = await mcp_call("gmail-mcp", "list_messages", {
            "user_id": user_id,
            "since": since.isoformat(),
            "limit": 50
        })

        zoho = await mcp_call("zoho-mail-mcp", "list_messages", {
            "user_id": user_id,
            "since": since.isoformat(),
            "limit": 50
        })

        return gmail + zoho
```

### Studio Page Integration

```typescript
// apps/ui/app/studio/page.tsx
export default function StudioPage() {
  const { data: context, isLoading } = useQuery({
    queryKey: ['daily-context'],
    queryFn: () => fetch('/api/context/daily').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Context is automatically available for LLM
  // User can chat with their day's context
}
```

---

## 8. GCP Deployment Guide (Beginner-Friendly)

### Step 1: Initial Setup (Day 1)

```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  pubsub.googleapis.com
```

### Step 2: Set Up Databases (Day 1-2)

```bash
# PostgreSQL (Cloud SQL)
gcloud sql instances create intellibooks-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

# Redis (Memorystore)
gcloud redis instances create intellibooks-cache \
  --size=1 \
  --region=us-central1
```

**For ChromaDB and Neo4j:** Use a single Compute Engine VM

```bash
# Create VM for ChromaDB + Neo4j
gcloud compute instances create intellibooks-data \
  --machine-type=e2-medium \
  --zone=us-central1-a \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB

# SSH in and run docker-compose with ChromaDB + Neo4j only
```

### Step 3: Deploy Services (Day 2-3)

```bash
# Build and deploy each service
# Example for Agent Service:

cd services/agents

# Build Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/intellibooks-agents

# Deploy to Cloud Run
gcloud run deploy intellibooks-agents \
  --image gcr.io/YOUR_PROJECT/intellibooks-agents \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=..." \
  --memory 1Gi \
  --cpu 1
```

### Step 4: Set Up Secrets (Day 1)

```bash
# Store sensitive values in Secret Manager
gcloud secrets create openai-api-key \
  --replication-policy="automatic"

echo -n "sk-..." | gcloud secrets versions add openai-api-key --data-file=-

# Reference in Cloud Run
gcloud run services update intellibooks-agents \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest"
```

### Deployment Order

```
Week 1:
  Day 1: GCP setup, Cloud SQL, Memorystore
  Day 2: Compute Engine VM with ChromaDB + Neo4j
  Day 3: Deploy existing services to Cloud Run
  Day 4: Test and fix issues
  Day 5: Set up CI/CD with Cloud Build

Week 2:
  Day 1-2: Build MCP Gateway service
  Day 3-4: Build Context Aggregator
  Day 5: Integration testing

Week 3+:
  Build remaining MCP servers (Gmail, Zoom, etc.)
  One server per day is a reasonable pace
```

---

## 9. CI/CD Pipeline

### Cloud Build Configuration

```yaml
# cloudbuild.yaml (place in each service directory)
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$COMMIT_SHA', '.']

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$COMMIT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${_SERVICE_NAME}'
      - '--image=gcr.io/$PROJECT_ID/${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--quiet'

substitutions:
  _SERVICE_NAME: 'intellibooks-agents'  # Override per service

options:
  logging: CLOUD_LOGGING_ONLY
```

### GitHub Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to GCP

on:
  push:
    branches: [main]
    paths:
      - 'services/**'
      - 'apps/**'

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.changes.outputs.services }}
    steps:
      - uses: actions/checkout@v4
      - id: changes
        run: |
          # Detect which services changed
          # Output list of services to deploy

  deploy:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect-changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - run: |
          gcloud builds submit \
            --config=${{ matrix.service }}/cloudbuild.yaml \
            --substitutions=_SERVICE_NAME=${{ matrix.service }}
```

---

## 10. What NOT to Do

### Avoid These Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Use Kubernetes | Overkill for your team size, complex ops | Cloud Run auto-scales |
| Build custom message queue | Reinventing the wheel | Use Cloud Pub/Sub or existing RabbitMQ |
| Create monolithic MCP server | Hard to maintain and scale | One MCP server per integration |
| Direct database calls from UI | Security risk, tight coupling | Always go through API/MCP |
| Store secrets in code/env files | Security risk | Use Secret Manager |
| Deploy everything at once | Too risky, hard to debug | Deploy one service at a time |
| Over-engineer agent creation | Complexity without value | Start with static agents, add dynamic later |
| Use multiple LLM providers initially | Complexity | Pick one (OpenRouter) and stick with it |

### Avoid These Technologies (For Now)

| Technology | Why to Avoid |
|------------|--------------|
| Kubernetes/GKE | Requires dedicated DevOps expertise |
| Terraform | Learn GCP console first, then automate |
| Istio/Service Mesh | Massive overkill |
| Custom orchestration | Cloud Run handles this |
| Multiple cloud providers | Stick to GCP only |
| GraphQL Federation | REST + MCP is simpler |

---

## 11. Cost Estimation (GCP)

### Monthly Estimate (Development/Small Scale)

| Service | Specification | Est. Cost |
|---------|--------------|-----------|
| Cloud Run (5 services) | 1 vCPU, 1GB each | ~$50/month |
| Cloud SQL (PostgreSQL) | db-f1-micro | ~$10/month |
| Memorystore (Redis) | 1GB | ~$35/month |
| Compute Engine (ChromaDB+Neo4j) | e2-medium | ~$25/month |
| Cloud Storage | 10GB | ~$1/month |
| Cloud Build | 120 min/day | Free tier |
| **Total** | | **~$120/month** |

### Scaling Notes
- Cloud Run auto-scales to zero when not in use
- Most cost is in always-on databases
- Consider scaling down databases during development

---

## 12. Migration Path

### Phase 1: Local Development (Current)
```
Docker Compose → All services local
Status: COMPLETE
```

### Phase 2: Hybrid (Next 2 weeks)
```
Databases → GCP (Cloud SQL, Memorystore, Compute Engine)
Services → Still local, pointing to GCP databases
Status: TODO
```

### Phase 3: Full Cloud (Week 3-4)
```
All services → Cloud Run
MCP Gateway → Cloud Run
CI/CD → Cloud Build + GitHub Actions
Status: TODO
```

### Phase 4: MCP Integrations (Week 5+)
```
Build remaining MCP servers
Context Aggregator
Agent Factory
Status: TODO
```

---

## 13. File Structure (Target)

```
IntelliBooksStudio/
├── apps/
│   └── ui/                          # Next.js frontend (KEEP)
├── services/
│   ├── agents/                      # Agent service (KEEP)
│   ├── rag/                         # RAG service (KEEP)
│   ├── websocket/                   # WebSocket service (KEEP)
│   ├── rbac/                        # RBAC service (KEEP)
│   ├── intellibooks_db/             # DB utilities (KEEP)
│   ├── mcp-gateway/                 # NEW: MCP routing
│   ├── context-aggregator/          # NEW: Daily context
│   └── agent-factory/               # NEW: Dynamic agents
├── mcp-servers/
│   ├── database-mcp/                # DONE
│   ├── github-mcp/                  # DONE
│   ├── slack-mcp/                   # DONE
│   ├── teams-mcp/                   # DONE
│   ├── mcp-registry/                # DONE
│   ├── gmail-mcp/                   # TODO
│   ├── zoho-mail-mcp/               # TODO
│   ├── zoho-cliq-mcp/               # TODO
│   ├── drive-mcp/                   # TODO
│   ├── clickup-mcp/                 # TODO
│   ├── azure-devops-mcp/            # TODO
│   ├── zoom-mcp/                    # TODO
│   ├── erp-mcp/                     # TODO
│   ├── neo4j-mcp/                   # TODO
│   └── chromadb-mcp/                # TODO
├── packages/
│   ├── agent-framework/             # KEEP
│   ├── auth/                        # KEEP
│   └── core/                        # KEEP
├── infrastructure/
│   ├── docker/                      # Local development (KEEP)
│   └── gcp/                         # NEW: GCP configs
│       ├── cloudbuild/
│       ├── terraform/               # Future: IaC
│       └── scripts/
└── docs/
    └── architecture/
        └── SYSTEM_ARCHITECTURE.md   # This document
```

---

## Summary

### What You Keep
- All existing services (Agents, RAG, WebSocket, RBAC)
- All existing MCP servers
- Docker Compose for local development
- Current database setup

### What You Build
1. **MCP Gateway** - Central router for MCP calls
2. **Context Aggregator** - Pull 24hr context from integrations
3. **Agent Factory** - Create agents dynamically
4. **New MCP Servers** - Gmail, Zoom, ClickUp, Azure DevOps, etc.

### Deployment Strategy
1. Start with Cloud SQL + Memorystore
2. Deploy services to Cloud Run one by one
3. Build MCP integrations incrementally
4. Use Cloud Build for CI/CD

### Key Principles
- MCP for all communication
- Cloud Run over Kubernetes
- One integration = One MCP server
- Simple > Perfect
