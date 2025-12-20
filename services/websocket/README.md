# WebSocket Service

Real-time chat messaging and meeting transcription service for Intellibooks Studio.

## Features

- **WebSocket connections** for real-time chat
- **Session-based message broadcasting**
- **Connection management** per session
- **Live meeting recording** with real-time transcription
- **Background processing** for meeting chunks
- **Redis-backed storage** for sessions and chunks
- **Post-processing pipeline**: Summarization, keyword extraction, mood analysis, agenda extraction
- **Abrupt end detection** with automatic background processing
- **Audio transcription** using local Whisper.cpp model

## Setup

### Prerequisites

- Python 3.11+
- Redis (for session and chunk storage)
- Whisper.cpp (for local audio transcription)
- FFmpeg (for audio format conversion)

### Installation

```bash
cd services/websocket
pip install -e ".[dev]"
```

### Redis Setup

Ensure Redis is running:

```bash
# Check if Redis is running
redis-cli ping

# If not installed, install Redis:
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis

# Start Redis
redis-server
```

### Whisper.cpp Installation

This service uses **whisper.cpp** for local audio transcription. Follow the instructions for your operating system:

#### Ubuntu/Debian Linux

```bash
# 1. Install system dependencies
sudo apt update
sudo apt install -y ffmpeg python3 python3-pip cmake build-essential

# 2. Clone whisper.cpp repository
cd ~
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# 3. Build whisper.cpp
cmake -B build
cmake --build build -j

# 4. Download the Whisper model (small model recommended for balance of speed/accuracy)
bash ./models/download-ggml-model.sh small

# 5. Verify installation
./build/bin/whisper-cli --help

# 6. Note the paths for configuration
# Whisper binary: ~/whisper.cpp/build/bin/whisper-cli
# Model file: ~/whisper.cpp/models/ggml-small.bin
```

#### macOS

```bash
# 1. Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install dependencies
brew install cmake ffmpeg

# 3. Clone whisper.cpp repository
cd ~
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# 4. Build whisper.cpp
cmake -B build
cmake --build build -j

# 5. Download the Whisper model
bash ./models/download-ggml-model.sh small

# 6. Verify installation
./build/bin/whisper-cli --help

# 7. Note the paths for configuration
# Whisper binary: ~/whisper.cpp/build/bin/whisper-cli
# Model file: ~/whisper.cpp/models/ggml-small.bin
```

#### Windows

```powershell
# 1. Install dependencies using Chocolatey (https://chocolatey.org/)
# Run PowerShell as Administrator
choco install git cmake ffmpeg

# 2. Install Visual Studio Build Tools
# Download and install from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++" workload

# 3. Clone whisper.cpp repository
cd %USERPROFILE%
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

# 4. Build whisper.cpp
cmake -B build
cmake --build build --config Release

# 5. Download the Whisper model
# Download from: https://huggingface.co/ggerganov/whisper.cpp/tree/main
# Place ggml-small.bin in whisper.cpp\models\
# Alternative: Use PowerShell script
.\models\download-ggml-model.ps1 small

# 6. Verify installation
.\build\bin\Release\whisper-cli.exe --help

# 7. Note the paths for configuration
# Whisper binary: C:\Users\YourUsername\whisper.cpp\build\bin\Release\whisper-cli.exe
# Model file: C:\Users\YourUsername\whisper.cpp\models\ggml-small.bin
```

### Available Whisper Models

Choose a model based on your needs:

| Model | Size | Speed | Accuracy | Recommended For |
|-------|------|-------|----------|-----------------|
| tiny | 75 MB | Fastest | Basic | Quick testing |
| base | 142 MB | Fast | Good | Development |
| **small** | 466 MB | **Balanced** | **Very Good** | **Production (Recommended)** |
| medium | 1.5 GB | Slow | Excellent | High accuracy needs |
| large | 2.9 GB | Slowest | Best | Maximum accuracy |

To download a different model:

```bash
# Linux/macOS
bash ./models/download-ggml-model.sh <model-name>

# Windows
.\models\download-ggml-model.ps1 <model-name>
```

### Configuring Whisper Paths

After installation, configure the paths in your `.env` file:

```bash
# .env file
WHISPER_PATH="/home/jipl/whisper.cpp/build/bin/whisper-cli"
WHISPER_MODEL_PATH="/home/jipl/whisper.cpp/models/ggml-small.bin"
```

Or update the default paths in `src/config.py` if you prefer.

## Running

```bash
# Development (from workspace root)
pnpm dev:ws

# Or manually
cd services/websocket
uvicorn src.main:app --reload --host 0.0.0.0 --port 8004

# Or use the main file
python -m src.main
```

## API Endpoints

### WebSocket Endpoint

Connect to: `ws://localhost:8004/ws/chat/{session_id}`

### REST API Endpoints

#### Meeting Recording

- `POST /api/meetings/start` - Start a new meeting recording session
- `POST /api/meetings/{session_id}/chunk` - Upload and transcribe audio chunk
- `GET /api/meetings/{session_id}/transcript` - Get current transcript
- `GET /api/meetings/{session_id}/status` - Get meeting processing status
- `GET /api/meetings/{session_id}/metadata` - Get meeting metadata (summary, keywords, mood, agenda)
- `POST /api/meetings/{session_id}/stop` - Stop meeting and trigger background processing
- `GET /api/meetings/{session_id}` - Get meeting session details

#### Audio Transcription

- `POST /api/transcription/transcribe` - Transcribe audio file (uses Deepgram)

### Message Format

**Send:**
```json
{
  "type": "message",
  "content": "Your message here",
  "session_id": "session-123",
  "user_id": "user-456",
  "metadata": {}
}
```

**Receive:**
```json
{
  "type": "message",
  "content": "Response from assistant",
  "role": "assistant",
  "session_id": "session-123",
  "message_id": "msg-789",
  "timestamp": "2025-01-19T10:00:00Z",
  "metadata": {}
}
```

**Transcript Update (WebSocket):**
```json
{
  "type": "transcript_update",
  "event": "transcript_updated",
  "session_id": "session-123",
  "content": "Current transcript text...",
  "metadata": {
    "chunks_processed": 5,
    "total_chunks": 10,
    "transcript_length": 1234
  },
  "timestamp": "2025-01-19T10:00:00Z"
}
```

## Configuration

Port is configured in `packages/core/ports.json` (default: 8004).

### Environment Variables

Create a `.env` file in the project root or service directory:

```bash
# Service Configuration
DEBUG=false
HOST=0.0.0.0

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Whisper.cpp Configuration
WHISPER_PATH=/home/jipl/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL_PATH=/home/jipl/whisper.cpp/models/ggml-small.bin

# Agent Service
AGENT_SERVICE_URL=http://localhost:8001

# Deepgram (for file transcription)
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Hugging Face (for speaker diarization)
HF_TOKEN=your_huggingface_token_here

# CORS
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

### Speaker Diarization Setup (Optional)

The system supports speaker diarization using `pyannote.audio`. This requires:

1. **Hugging Face Token**: 
   - Sign up at [huggingface.co](https://huggingface.co)
   - Generate token at [Settings > Access Tokens](https://huggingface.co/settings/tokens)
   - Accept model terms for:
     - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
     - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)

2. **Set Token**:
   ```bash
   HF_TOKEN="hf_your_token_here"
   ```

## Architecture

### Meeting Recording Flow

1. **Start Recording**: Client calls `POST /api/meetings/start` → Session created in Redis
2. **Chunk Upload**: Client sends audio chunks every 10 seconds → Stored in Redis queue
3. **Live Transcription**: Chunks transcribed immediately for real-time display
4. **WebSocket Updates**: Transcript updates pushed via WebSocket
5. **Stop/Abrupt End**: 
   - Normal stop: Client calls `POST /api/meetings/{session_id}/stop`
   - Abrupt end: Detected after 60s of inactivity → Auto-triggers background processing
6. **Background Processing**: All chunks processed from Redis queue
7. **Post-Processing**: Summarization, keywords, mood, agenda, metrics extraction
8. **Completion**: Metadata stored in Redis, session marked as completed

### Background Processing

- Processes chunks even if client disconnects
- State persisted in Redis (survives server restarts)
- Automatic recovery of incomplete sessions
- Post-processing pipeline runs after all chunks are transcribed

## Troubleshooting

### Port Already in Use

The service will check if the port is in use and prompt to kill the existing process.

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG

# If not, start Redis
redis-server
```

### Whisper Binary Not Found

Update the paths in `.env`:

```bash
WHISPER_PATH="/path/to/your/whisper-cli"
WHISPER_MODEL_PATH="/path/to/your/model.bin"
```

### Module Import Errors

Ensure Python services are installed as editable packages:

```bash
# From workspace root
./scripts/setup-python-services.sh

# Or manually
cd services/websocket
pip install -e ".[dev]"
```

## TODO

- [ ] Database persistence for completed meetings
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] Message history retrieval
- [ ] Enhanced speaker diarization integration
- [ ] Meeting replay functionality
