"""WebSocket Service Main Application."""

import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import get_settings
from .connection_manager import manager
from .handlers.chat_handler import handle_chat_message
from .models.messages import ChatResponse, SystemMessage, ErrorMessage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    logger.info(f"Starting {settings.service_name} on {settings.host}:{settings.port}")
    yield
    logger.info(f"Shutting down {settings.service_name}")


app = FastAPI(
    title="WebSocket Service",
    description="Real-time chat messaging service for Audio Insight",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "version": "1.0.0",
        "active_sessions": len(manager.get_all_sessions()),
        "total_connections": sum(
            manager.get_session_connections_count(session_id)
            for session_id in manager.get_all_sessions()
        ),
    }


@app.get("/api/sessions")
async def list_sessions():
    """List all active sessions."""
    sessions = manager.get_all_sessions()
    return {
        "sessions": [
            {
                "session_id": session_id,
                "connections": manager.get_session_connections_count(session_id),
            }
            for session_id in sessions
        ]
    }


@app.websocket("/ws/chat/{session_id}")
async def websocket_chat_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for chat messaging.
    
    Clients connect to: ws://localhost:8004/ws/chat/{session_id}
    """
    await manager.connect(websocket, session_id)
    
    # Send welcome message
    welcome_message = SystemMessage(
        event="connected",
        content=f"Connected to chat session {session_id}",
        session_id=session_id,
    )
    await manager.send_personal_message(welcome_message.model_dump(mode="json"), websocket)

    # Notify other users in session
    user_joined_message = SystemMessage(
        event="user_joined",
        content="A new user joined the conversation",
        session_id=session_id,
    )
    await manager.broadcast_to_session(
        user_joined_message.model_dump(mode="json"),
        session_id,
        exclude=websocket,
    )
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                error_msg = ErrorMessage(
                    error="Invalid JSON format",
                    code="INVALID_JSON",
                    session_id=session_id,
                )
                await manager.send_personal_message(error_msg.model_dump(mode="json"), websocket)
                continue
            
            # Handle different message types
            message_type = message_data.get("type", "message")
            
            if message_type == "message":
                # Process chat message
                response = await handle_chat_message(websocket, message_data, session_id)
                
                if response:
                    # Send response back to sender
                    await manager.send_personal_message(
                        response.model_dump(mode="json"), websocket
                    )
                    
                    # Broadcast to all other users in the session (for shared chats)
                    await manager.broadcast_to_session(
                        response.model_dump(mode="json"),
                        session_id,
                        exclude=websocket,
                    )
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        
        # Notify other users in session
        user_left_message = SystemMessage(
            event="user_left",
            content="A user left the conversation",
            session_id=session_id,
        )
        await manager.broadcast_to_session(
            user_left_message.model_dump(mode="json"),
            session_id,
        )
        logger.info(f"Client disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

