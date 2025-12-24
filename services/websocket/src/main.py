"""WebSocket Service Main Application."""

import json
import logging
import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import Optional

from .config import get_settings
from .connection_manager import manager
from .handlers.smart_handler import handle_smart_message
from .handlers.chat_handler import handle_chat_message
from .utils.permissions import get_user_role
from .models.db import SessionLocal
from .models.messages import ChatResponse, SystemMessage, ErrorMessage
from .models.routes import transcription, meetings, conversations, notifications

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Add intellibooks_db module to path
# __file__ = services/websocket/src/main.py
# parent.parent.parent = services/
services_path = Path(__file__).parent.parent.parent
intellibooks_db_path = services_path / "intellibooks_db"
if intellibooks_db_path.exists() and str(services_path) not in sys.path:
    sys.path.insert(0, str(services_path))
    logger.info(f"Added {services_path} to sys.path for intellibooks_db")

settings = get_settings()

# Global database instances
db_pool = None
session_repo = None
message_repo = None
document_repo = None


# Request/Response models
class CreateSessionRequest(BaseModel):
    session_id: Optional[str] = None
    title: str = "New Notebook"


class UpdateSessionRequest(BaseModel):
    title: str


class DatabaseConfigRequest(BaseModel):
    db_type: str
    host: str
    port: int
    database: str
    user: str
    password: str
    schema: Optional[str] = None
    ssl_mode: Optional[str] = None
    pool_size: int = 10
    max_overflow: int = 20
    extra_params: Optional[dict] = None


async def init_database():
    """Initialize database connection and repositories."""
    global db_pool, session_repo, message_repo, document_repo

    try:
        from intellibooks_db.database import get_db_pool, ensure_schema, SessionRepository, MessageRepository, DocumentRepository

        db_pool = await get_db_pool()
        if db_pool:
            await ensure_schema()
            session_repo = SessionRepository(db_pool)
            message_repo = MessageRepository(db_pool)
            document_repo = DocumentRepository(db_pool)
            logger.info("✅ PostgreSQL persistence enabled for WebSocket service")
        else:
            logger.warning("⚠️ Running without PostgreSQL persistence")
    except ImportError as e:
        logger.warning(f"Database module not available: {e}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    import asyncio
    from .utils.redis_client import get_redis_client, close_redis_client
    from .utils.background_processor import check_abrupt_endings

    logger.info(f"Starting {settings.service_name} on {settings.host}:{settings.port}")

    # Initialize database connection
    await init_database()

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

    # Close database connection
    if db_pool:
        from intellibooks_db.database import close_db_pool
        await close_db_pool()

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

# Include route modules
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
    """List all sessions (from database if available, otherwise active WebSocket sessions)."""
    # Get active WebSocket sessions
    active_sessions = manager.get_all_sessions()

    # If we have database persistence, return persisted sessions
    if session_repo:
        db_sessions = await session_repo.list_all()
        return {
            "sessions": [
                {
                    "session_id": session["session_id"],
                    "title": session["title"],
                    "document_count": session.get("document_count", 0),
                    "message_count": session.get("message_count", 0),
                    "is_active": session["is_active"],
                    "connections": manager.get_session_connections_count(session["session_id"]),
                    "created_at": session["created_at"].isoformat() if session.get("created_at") else None,
                    "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None,
                    "last_message_at": session["last_message_at"].isoformat() if session.get("last_message_at") else None,
                }
                for session in db_sessions
            ],
            "persistence_enabled": True,
        }

    # Fallback to WebSocket sessions only
    return {
        "sessions": [
            {
                "session_id": session_id,
                "connections": manager.get_session_connections_count(session_id),
            }
            for session_id in active_sessions
        ],
        "persistence_enabled": False,
    }


@app.post("/api/sessions")
async def create_session(request: CreateSessionRequest):
    """Create a new chat session (notebook)."""
    import time

    session_id = request.session_id or f"session-{int(time.time() * 1000)}"

    if session_repo:
        session = await session_repo.create(session_id, request.title)
        if session:
            return {
                "success": True,
                "session_id": session["session_id"],
                "title": session["title"],
                "created_at": session["created_at"].isoformat() if session.get("created_at") else None,
            }
        raise HTTPException(status_code=500, detail="Failed to create session")

    # No persistence - just return the session_id
    return {
        "success": True,
        "session_id": session_id,
        "title": request.title,
        "persisted": False,
    }


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, include_messages: bool = False):
    """Get session details with optional message history."""
    if not session_repo:
        raise HTTPException(status_code=503, detail="Session persistence not enabled")

    session = await session_repo.get_by_session_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = {
        "session_id": session["session_id"],
        "title": session["title"],
        "document_count": session.get("document_count", 0),
        "message_count": session.get("message_count", 0),
        "is_active": session["is_active"],
        "connections": manager.get_session_connections_count(session_id),
        "created_at": session["created_at"].isoformat() if session.get("created_at") else None,
        "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None,
    }

    # Include messages if requested
    if include_messages and message_repo:
        messages = await message_repo.get_by_session(session_id)
        result["messages"] = [
            {
                "message_id": msg["message_id"],
                "role": msg["role"],
                "content": msg["content"],
                "sources": msg.get("sources", []),
                "intent": msg.get("intent"),
                "rag_used": msg.get("rag_used", False),
                "created_at": msg["created_at"].isoformat() if msg.get("created_at") else None,
            }
            for msg in messages
        ]

    # Include documents if available
    if document_repo:
        documents = await document_repo.get_by_session(session_id)
        result["documents"] = [
            {
                "document_id": doc["document_id"],
                "filename": doc["filename"],
                "file_type": doc["file_type"],
                "chunks_count": doc["chunks_count"],
                "status": doc["status"],
                "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
            }
            for doc in documents
        ]

    return result


@app.put("/api/sessions/{session_id}")
async def update_session(session_id: str, request: UpdateSessionRequest):
    """Update session title."""
    if not session_repo:
        raise HTTPException(status_code=503, detail="Session persistence not enabled")

    success = await session_repo.update_title(session_id, request.title)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "session_id": session_id, "title": request.title}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its messages/documents."""
    if not session_repo:
        raise HTTPException(status_code=503, detail="Session persistence not enabled")

    success = await session_repo.delete(session_id)
    return {"success": success, "session_id": session_id}


@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, limit: int = 100, offset: int = 0):
    """Get messages for a session."""
    if not message_repo:
        raise HTTPException(status_code=503, detail="Message persistence not enabled")

    messages = await message_repo.get_by_session(session_id, limit=limit, offset=offset)
    return {
        "session_id": session_id,
        "messages": [
            {
                "message_id": msg["message_id"],
                "role": msg["role"],
                "content": msg["content"],
                "sources": msg.get("sources", []),
                "intent": msg.get("intent"),
                "rag_used": msg.get("rag_used", False),
                "processing_time_ms": msg.get("processing_time_ms"),
                "created_at": msg["created_at"].isoformat() if msg.get("created_at") else None,
            }
            for msg in messages
        ],
        "total": len(messages),
    }


# Database configuration endpoints for analytics agent
@app.post("/api/sessions/{session_id}/database/config")
async def configure_database(session_id: str, request: DatabaseConfigRequest):
    """Configure database connection for analytics agent in a session."""
    try:
        # Validate database type
        valid_types = ["postgresql", "snowflake", "mysql", "sqlite"]
        if request.db_type.lower() not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid database type. Must be one of: {', '.join(valid_types)}"
            )
        
        config_dict = {
            "db_type": request.db_type.lower(),
            "host": request.host,
            "port": request.port,
            "database": request.database,
            "user": request.user,
            "password": request.password,
            "schema": request.schema,
            "ssl_mode": request.ssl_mode,
            "pool_size": request.pool_size,
            "max_overflow": request.max_overflow,
            "extra_params": request.extra_params,
        }
        
        # Test connection by creating a temporary agent instance
        try:
            from services.agents.src.agents.analytics_agent import AnalyticsAgent
            test_agent = AnalyticsAgent(db_config=config_dict, session_id=session_id)
            # Connection is tested during agent initialization
            
            # Store configuration in Redis
            try:
                from .utils.redis_client import save_db_config
                await save_db_config(session_id, config_dict)
            except Exception as e:
                logger.warning(f"Failed to save database config to Redis: {e}. Configuration will not persist.")
            
            return {
                "success": True,
                "session_id": session_id,
                "message": "Database configuration saved and connection verified",
                "config": {**config_dict, "password": "***"}  # Don't return password
            }
        except Exception as e:
            logger.error(f"Failed to test database connection: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to connect to database: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error configuring database: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/sessions/{session_id}/database/config")
async def get_database_config(session_id: str):
    """Get database configuration for a session."""
    try:
        from .utils.redis_client import get_db_config
        config = await get_db_config(session_id)
        
        if config:
            return {
                "success": True,
                "session_id": session_id,
                "configured": True,
                "config": {**config, "password": "***"}  # Don't return password
            }
        else:
            return {
                "success": False,
                "session_id": session_id,
                "configured": False,
                "message": "No database configuration found for this session"
            }
    except Exception as e:
        logger.error(f"Error getting database config: {e}")
        return {
            "success": False,
            "session_id": session_id,
            "configured": False,
            "message": f"Error retrieving configuration: {str(e)}"
        }


@app.delete("/api/sessions/{session_id}/database/config")
async def delete_database_config(session_id: str):
    """Remove database configuration for a session."""
    try:
        from .utils.redis_client import delete_db_config
        await delete_db_config(session_id)
        return {
            "success": True,
            "session_id": session_id,
            "message": "Database configuration removed"
        }
    except Exception as e:
        logger.error(f"Error deleting database config: {e}")
        raise HTTPException(status_code=500, detail=f"Error removing configuration: {str(e)}")


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

