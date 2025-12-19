# Intellibooks Agent Service

AI Agent Service for Intellibooks Studio providing audio transcription, translation, summarization, intent detection, and keyword extraction.

## Features

- **Audio Transcription** - OpenAI Whisper for speech-to-text
- **Translation** - Multi-language translation (30+ languages)
- **Summarization** - Generate summaries with key points
- **Intent Detection** - Classify content intent and sentiment
- **Keyword Extraction** - Extract keywords, keyphrases, entities
- **Multi-Provider LLM** - OpenAI, Anthropic, OpenRouter support
- **LangGraph Workflows** - Agent orchestration and pipelines

## Architecture

```
┌─────────────────┐
│   Audio File    │
│   (mp3, wav)    │
└────────┬────────┘
         │
         v
┌─────────────────┐     ┌─────────────────┐
│   Whisper       │────>│   Transcript    │
│   Transcription │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         v                       v                       v
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Translation   │   │  Summarization  │   │ Intent/Keywords │
│   Agent         │   │  Agent          │   │ Agent           │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────────────────────────────────────────────────┐
│                    Processing Result                         │
│   - Transcription                                           │
│   - Translations (multiple languages)                       │
│   - Summary with key points                                 │
│   - Intent classification                                   │
│   - Keywords and entities                                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- FFmpeg (for audio processing)
- Docker (optional, for PostgreSQL/Redis)

### Installation

```bash
cd services/agents

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -e "."

# Install spaCy model (optional, for NLP)
python -m spacy download en_core_web_sm
```

### Install FFmpeg

**Windows:**
```powershell
winget install FFmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### Run the Service

```bash
# From project root
pnpm dev:agents

# Or manually
cd services/agents
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8001
```

## Configuration

Environment variables (set in `.env` at project root):

```env
# LLM Providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
DEFAULT_LLM_PROVIDER=openrouter
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Whisper Model (tiny, base, small, medium, large)
WHISPER_MODEL=base

# Storage
AUDIO_STORAGE_PATH=./data/audio
UPLOAD_STORAGE_PATH=./data/uploads
MAX_AUDIO_SIZE_MB=100

# Database (optional)
DATABASE_URL=postgresql://admin:password@localhost:5432/intellibooks

# Redis (optional)
REDIS_URL=redis://localhost:6379

# RAG Service
RAG_SERVICE_URL=http://localhost:8002
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Upload Audio
```
POST /api/upload
Content-Type: multipart/form-data

file: <audio binary>
```

Response:
```json
{
  "file_id": "audio_abc123",
  "filename": "recording.mp3",
  "size_bytes": 1234567,
  "duration_seconds": 120.5
}
```

### Process Audio
```
POST /api/agents/process
Content-Type: application/json

{
  "audio_file_id": "audio_abc123",
  "tasks": ["transcribe", "summarize", "detect_intent", "extract_keywords"],
  "options": {
    "target_languages": ["es", "fr"],
    "summary_type": "key_points",
    "max_keywords": 10
  }
}
```

### Analyze Text Directly
```
POST /api/agents/analyze-text
Content-Type: application/json

{
  "text": "Your text content here...",
  "tasks": ["summarize", "detect_intent", "extract_keywords"],
  "options": {
    "summary_type": "general"
  }
}
```

### Transcribe Only
```
POST /api/transcribe
Content-Type: multipart/form-data

file: <audio binary>
language: en (optional)
```

### Translate Text
```
POST /api/translate
Content-Type: application/json

{
  "text": "Hello world",
  "source_language": "en",
  "target_language": "es"
}
```

### Summarize Text
```
POST /api/summarize
Content-Type: application/json

{
  "text": "Long text to summarize...",
  "summary_type": "key_points"
}
```

Summary types: `general`, `key_points`, `action_items`, `quick`

### Detect Intent
```
POST /api/detect-intent
Content-Type: application/json

{
  "text": "I need help with my order"
}
```

Response:
```json
{
  "primary_intent": "support",
  "confidence": 0.92,
  "secondary_intents": ["inquiry"],
  "sentiment": "neutral",
  "urgency": "medium",
  "reasoning": "Customer seeking assistance..."
}
```

### Extract Keywords
```
POST /api/extract-keywords
Content-Type: application/json

{
  "text": "Machine learning and artificial intelligence...",
  "max_keywords": 10
}
```

### List Agents
```
GET /api/agents/registry
```

### Get Agent Identity
```
GET /api/agents/{agent_id}/identity
```

## Supported Audio Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| MP3 | .mp3 | audio/mpeg |
| WAV | .wav | audio/wav |
| FLAC | .flac | audio/flac |
| M4A | .m4a | audio/m4a |
| OGG | .ogg | audio/ogg |
| AAC | .aac | audio/aac |
| WMA | .wma | audio/x-ms-wma |
| WebM | .webm | audio/webm |

## Whisper Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny | 39M | Fastest | Good | Quick testing |
| base | 74M | Fast | Better | Development |
| small | 244M | Medium | Good | Production (balanced) |
| medium | 769M | Slow | Very Good | High accuracy |
| large | 1550M | Slowest | Best | Maximum accuracy |

## Supported Languages

Translation supports 30+ languages including:

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
- Russian (ru)
- And many more...

## Intent Categories

- `inquiry` - Questions seeking information
- `complaint` - Expressing dissatisfaction
- `feedback` - Providing opinions or suggestions
- `request` - Asking for action
- `information` - Sharing information
- `support` - Seeking help
- `sales` - Purchase-related
- `other` - Unclassified

## Development

### Running Tests

```bash
cd services/agents
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
services/agents/
├── src/
│   ├── api/
│   │   └── main.py          # FastAPI application
│   ├── agents/              # Agent implementations
│   │   ├── transcription.py
│   │   ├── translation.py
│   │   ├── summarization.py
│   │   ├── intent.py
│   │   └── keyword.py
│   ├── config.py            # Configuration
│   └── __init__.py
├── tests/
├── data/                    # Audio/upload storage
├── pyproject.toml
└── README.md
```

## Key Components

### TranscriptionAgent

Uses OpenAI Whisper for speech-to-text:
- Multiple model sizes
- Language detection
- Word-level timestamps

### TranslationAgent

LLM-powered translation:
- Source language detection
- High-quality translations
- Context preservation

### SummarizationAgent

Generates summaries:
- Multiple summary types
- Key points extraction
- Action items identification

### IntentAgent

Classifies content:
- Intent categorization
- Sentiment analysis
- Urgency detection

### KeywordAgent

Extracts keywords:
- Keywords and keyphrases
- Named entity recognition
- Relevance scoring

## Troubleshooting

### FFmpeg Not Found
```
Error: FFmpeg not found
```
Solution: Install FFmpeg and ensure it's in PATH:
```bash
ffmpeg -version
```

### Whisper Model Download
```
Error: Model not found
```
Solution: Models download automatically on first use. Ensure internet connection.

### CUDA Out of Memory
```
Error: CUDA out of memory
```
Solution: Use a smaller Whisper model:
```env
WHISPER_MODEL=base  # or tiny
```

### API Key Errors
```
Error: Invalid API key
```
Solution: Verify API keys in `.env`:
```bash
echo $OPENROUTER_API_KEY
```

## License

MIT License
