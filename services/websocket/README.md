# WebSocket Service

Real-time chat messaging service for Audio Insight Platform.

## Features

- WebSocket connections for real-time chat
- Session-based message broadcasting
- Connection management per session
- Demo responses (Redis pub/sub integration pending)

## Setup

```bash
cd services/websocket
pip install -e ".[dev]"
```

## Running

```bash
# Development
uvicorn src.main:app --reload --host 0.0.0.0 --port 8004

# Or use the main file
python -m src.main
```

## WebSocket Endpoint

Connect to: `ws://localhost:8004/ws/chat/{session_id}`

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

## Configuration

Port is configured in `packages/core/ports.json` (default: 8004).

Environment variables:
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `AGENT_SERVICE_URL` - Agent service URL (default: http://localhost:8001)
- `DEBUG` - Enable debug mode (default: false)

## TODO

- [ ] Integrate Redis pub/sub for agent communication
- [ ] Message persistence to database
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] Message history retrieval

