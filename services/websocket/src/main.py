"""WebSocket Service Main Application."""

import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional

from .config import get_settings
from .connection_manager import manager
from .handlers.smart_handler import handle_smart_message
from .handlers.chat_handler import handle_chat_message
from .utils.permissions import get_user_role
from .models.db import SessionLocal
from .models.messages import ChatResponse, SystemMessage, ErrorMessage
from .routes import transcription, meetings, conversations, notifications

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
    import asyncio
    from .utils.redis_client import get_redis_client, close_redis_client
    from .utils.background_processor import check_abrupt_endings
    
    logger.info(f"Starting {settings.service_name} on {settings.host}:{settings.port}")
    
    # Initialize Redis connection
    if settings.redis_enabled:
        try:
            await get_redis_client()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
    
    # Start background task for abrupt end detection
    async def check_abrupt_ends_periodically():
        while True:
            try:
                await check_abrupt_endings()
            except Exception as e:
                logger.error(f"Error checking abrupt endings: {e}")
            await asyncio.sleep(30)  # Check every 30 seconds
    
    abrupt_end_task = asyncio.create_task(check_abrupt_ends_periodically())
    
    yield
    
    # Cleanup
    abrupt_end_task.cancel()
    try:
        await abrupt_end_task
    except asyncio.CancelledError:
        pass
    
    if settings.redis_enabled:
        await close_redis_client()
    
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

# Include routers
app.include_router(transcription.router)
app.include_router(transcription.router)
app.include_router(meetings.router)
app.include_router(conversations.router)
app.include_router(notifications.router)


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
async def websocket_chat_endpoint(websocket: WebSocket, session_id: str, user_id: Optional[str] = None):
    """
    WebSocket endpoint for chat messaging.
    
    Clients connect to: ws://localhost:8004/ws/chat/{session_id}?user_id={user_id}
    """
    # If user_id not provided in arguments, try query params
    if not user_id:
        user_id = websocket.query_params.get("user_id")

    db = SessionLocal()
    try:
        # Check permissions
        from uuid import UUID
        
        # Allow temporary frontend-generated sessions
        if session_id.startswith("session-"):
            logger.info(f"Allowing temporary session: {session_id}")
            await manager.connect(websocket, session_id)
        else:
            try:
                conv_uuid = UUID(session_id)
                role = await get_user_role(db, conv_uuid, user_id)
                if not role:
                    logger.warning(f"Permission denied for user {user_id} on session {session_id}")
                    await websocket.close(code=1008) # Policy Violation
                    return
                
                await manager.connect(websocket, session_id)
            except ValueError:
                logger.error(f"Invalid session ID (not UUID or session-): {session_id}")
                await websocket.close(code=1008) # Policy Violation
                return
    finally:
        db.close()
    
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
            
            # Handle all message types with smart routing
            # The smart handler auto-detects intent (chat vs research vs hybrid)
            message_type = message_data.get("type", "message")

            if message_type in ("message", "research", "smart"):
                # Process with smart handler (auto-detects intent)
                response = await handle_smart_message(websocket, message_data, session_id)

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
    
    # Use app directly instead of string path for better reliability
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

