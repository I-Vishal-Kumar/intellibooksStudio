# Intellibooks RAG Service

RAG (Retrieval-Augmented Generation) Pipeline Service for Intellibooks Studio with distributed processing support.

## Features

- **Document Ingestion** - Process PDF, DOCX, TXT, HTML, Markdown, JSON, CSV files
- **Vector Embeddings** - Sentence Transformers (all-MiniLM-L6-v2)
- **ChromaDB** - Docker-based vector database for semantic search
- **Ray Integration** - Distributed parallel document processing
- **RabbitMQ Integration** - Async task queuing for scalable ingestion
- **LLM-Powered Q&A** - RAG queries via OpenRouter/OpenAI/Anthropic

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Document      │     │   Embedding     │     │   ChromaDB      │
│   Processor     │────>│   Service       │────>│   (Docker)      │
│   (PDF, DOCX)   │     │   (MiniLM)      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        v                                               v
┌─────────────────┐                           ┌─────────────────┐
│   Ray Cluster   │                           │   LLM Provider  │
│   (Distributed) │                           │   (OpenRouter)  │
└─────────────────┘                           └─────────────────┘
        │
        v
┌─────────────────┐
│   RabbitMQ      │
│   (Task Queue)  │
└─────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- Docker & Docker Compose
- (Optional) Ray cluster for distributed processing

### Installation

```bash
cd services/rag

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -e "."

# Install optional Ray support (Linux/Mac only)
pip install -e ".[ray]"
```

### Start Infrastructure

```bash
cd infrastructure/docker

# Start ChromaDB and RabbitMQ
docker-compose up -d chroma rabbitmq

# (Optional) Start Ray cluster
docker-compose --profile ray up -d
```

### Run the Service

```bash
# From project root
pnpm dev:rag

# Or manually
cd services/rag
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8002
```

## Configuration

Environment variables (set in `.env` at project root):

```env
# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION=intellibooks_knowledge

# Embedding Model
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Document Processing
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_MAX_WORKERS=4

# Ray (Docker-based on Windows)
USE_RAY=true
RAY_ADDRESS=ray://localhost:10001

# RabbitMQ
USE_RABBITMQ=true
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=devpassword123

# LLM Provider
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Ingest Documents
```
POST /api/ingest
Content-Type: multipart/form-data

file: <binary>
metadata: {"source": "upload", "category": "documents"}
```

### Query Knowledge Base (RAG)
```
POST /api/query
Content-Type: application/json

{
  "query": "What are the key features?",
  "top_k": 5,
  "filters": {"category": "documents"}
}
```

Response:
```json
{
  "answer": "Based on the knowledge base...",
  "sources": [
    {
      "id": "doc_abc123_chunk_0",
      "content_preview": "...",
      "score": 0.85,
      "metadata": {"filename": "doc.pdf"}
    }
  ],
  "query": "What are the key features?",
  "processing_time_ms": 245.5,
  "confidence": 0.85
}
```

### Semantic Search (No LLM)
```
POST /api/search
Content-Type: application/json

{
  "query": "machine learning",
  "top_k": 10
}
```

### Get Statistics
```
GET /api/stats
```

Response:
```json
{
  "total_chunks": 1250,
  "collection": "intellibooks_knowledge",
  "embedding_model": "all-MiniLM-L6-v2",
  "chroma_host": "localhost",
  "chroma_port": 8000,
  "ray_enabled": true,
  "rabbitmq_enabled": true
}
```

### Delete Document
```
DELETE /api/documents/{document_id}
```

## Supported File Types

| Extension | Type | Description |
|-----------|------|-------------|
| `.pdf` | PDF | Adobe PDF documents |
| `.docx` | DOCX | Microsoft Word documents |
| `.doc` | DOCX | Legacy Word documents |
| `.txt` | Text | Plain text files |
| `.md` | Markdown | Markdown files |
| `.html` | HTML | Web pages |
| `.htm` | HTML | Web pages |
| `.json` | JSON | JSON data files |
| `.csv` | CSV | Comma-separated values |

## Distributed Processing

### Ray (Docker-based)

On Windows, Ray doesn't work with venv. Use Docker:

```bash
# Start Ray cluster
cd infrastructure/docker
docker-compose --profile ray up -d

# Access Ray Dashboard
open http://localhost:8265
```

The service connects to Ray at `ray://localhost:10001`.

### RabbitMQ

For async document processing:

```bash
# Start RabbitMQ
docker-compose up -d rabbitmq

# Access Management UI
open http://localhost:15672
# Login: admin / devpassword123
```

## Development

### Running Tests

```bash
cd services/rag
pytest tests/ -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

### Code Formatting

```bash
black src/ tests/
ruff check src/ tests/ --fix
```

## Project Structure

```
services/rag/
├── src/
│   ├── api/
│   │   └── main.py          # FastAPI application
│   ├── rag_pipeline.py      # Main RAG pipeline
│   └── __init__.py
├── tests/
├── pyproject.toml
└── README.md
```

## Key Components

### IntelliBooksPipeline

Main pipeline class with methods:

- `ingest_document()` - Ingest single document
- `ingest_documents_parallel()` - Parallel ingestion with Ray/threads
- `query()` - RAG query with LLM answer generation
- `search()` - Semantic search without LLM
- `delete_document()` - Remove document from index
- `clear()` - Clear entire knowledge base
- `get_stats()` - Get pipeline statistics

### DocumentProcessor

Handles document parsing and chunking:

- Text extraction from various formats
- Configurable chunk size and overlap
- Metadata preservation

### ChromaDBStore

Vector store wrapper:

- Document embedding and storage
- Similarity search
- Filtering support

### EmbeddingService

Singleton embedding service:

- Lazy model loading
- Batch encoding support
- Fallback for missing dependencies

## Troubleshooting

### ChromaDB Connection Failed
```
Error: Could not connect to Chroma
```
Solution: Ensure ChromaDB container is running:
```bash
docker-compose up -d chroma
```

### Ray Connection Failed
```
Error: Failed to connect to Ray cluster
```
Solution: Start Docker Ray cluster:
```bash
docker-compose --profile ray up -d
```

### RabbitMQ Connection Failed
```
Error: pika.exceptions.AMQPConnectionError
```
Solution: Start RabbitMQ and verify credentials:
```bash
docker-compose up -d rabbitmq
```

### Missing Dependencies
```
Error: pypdf not installed
```
Solution: Install document processing dependencies:
```bash
pip install pypdf python-docx beautifulsoup4
```

## License

MIT License
