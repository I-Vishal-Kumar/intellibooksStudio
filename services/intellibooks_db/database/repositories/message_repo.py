"""Repository for chat message operations."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
import json

try:
    from asyncpg import Pool
except ImportError:
    Pool = None

logger = logging.getLogger(__name__)


class MessageRepository:
    """Repository for chat message CRUD operations."""

    def __init__(self, pool: Pool):
        self.pool = pool

    async def create(
        self,
        message_id: str,
        session_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        intent: Optional[str] = None,
        intent_confidence: Optional[float] = None,
        rag_used: bool = False,
        processing_time_ms: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a new chat message."""
        try:
            async with self.pool.acquire() as conn:
                # Get session UUID
                session_uuid = await conn.fetchval(
                    "SELECT id FROM chat_sessions WHERE session_id = $1",
                    session_id,
                )
                if not session_uuid:
                    logger.error(f"Session not found: {session_id}")
                    return None

                row = await conn.fetchrow(
                    """
                    INSERT INTO chat_messages (
                        message_id, session_id, role, content, sources,
                        intent, intent_confidence, rag_used,
                        processing_time_ms, metadata
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (message_id) DO NOTHING
                    RETURNING *
                    """,
                    message_id,
                    session_uuid,
                    role,
                    content,
                    json.dumps(sources or []),
                    intent,
                    intent_confidence,
                    rag_used,
                    processing_time_ms,
                    json.dumps(metadata or {}),
                )

                # Update session's last_message_at
                await conn.execute(
                    """
                    UPDATE chat_sessions
                    SET last_message_at = NOW(), updated_at = NOW()
                    WHERE id = $1
                    """,
                    session_uuid,
                )

                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to create message: {e}")
            return None

    async def get_by_session(
        self,
        session_id: str,
        limit: int = 100,
        offset: int = 0,
        order: str = "asc",
    ) -> List[Dict[str, Any]]:
        """Get all messages for a session."""
        try:
            async with self.pool.acquire() as conn:
                order_dir = "ASC" if order.lower() == "asc" else "DESC"
                rows = await conn.fetch(
                    f"""
                    SELECT m.*
                    FROM chat_messages m
                    JOIN chat_sessions cs ON m.session_id = cs.id
                    WHERE cs.session_id = $1
                    ORDER BY m.created_at {order_dir}
                    LIMIT $2 OFFSET $3
                    """,
                    session_id,
                    limit,
                    offset,
                )
                # Parse JSON fields
                messages = []
                for row in rows:
                    msg = dict(row)
                    if isinstance(msg.get("sources"), str):
                        msg["sources"] = json.loads(msg["sources"])
                    if isinstance(msg.get("metadata"), str):
                        msg["metadata"] = json.loads(msg["metadata"])
                    messages.append(msg)
                return messages
        except Exception as e:
            logger.error(f"Failed to get messages for session: {e}")
            return []

    async def get_recent(
        self,
        session_id: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get recent messages for a session (for context window)."""
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT m.*
                    FROM chat_messages m
                    JOIN chat_sessions cs ON m.session_id = cs.id
                    WHERE cs.session_id = $1
                    ORDER BY m.created_at DESC
                    LIMIT $2
                    """,
                    session_id,
                    limit,
                )
                # Reverse to get chronological order
                messages = []
                for row in reversed(rows):
                    msg = dict(row)
                    if isinstance(msg.get("sources"), str):
                        msg["sources"] = json.loads(msg["sources"])
                    if isinstance(msg.get("metadata"), str):
                        msg["metadata"] = json.loads(msg["metadata"])
                    messages.append(msg)
                return messages
        except Exception as e:
            logger.error(f"Failed to get recent messages: {e}")
            return []

    async def count_by_session(self, session_id: str) -> int:
        """Count messages in a session."""
        try:
            async with self.pool.acquire() as conn:
                count = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM chat_messages m
                    JOIN chat_sessions cs ON m.session_id = cs.id
                    WHERE cs.session_id = $1
                    """,
                    session_id,
                )
                return count or 0
        except Exception as e:
            logger.error(f"Failed to count messages: {e}")
            return 0

    async def delete_by_session(self, session_id: str) -> int:
        """Delete all messages in a session."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    """
                    DELETE FROM chat_messages m
                    USING chat_sessions cs
                    WHERE m.session_id = cs.id AND cs.session_id = $1
                    """,
                    session_id,
                )
                # Extract count from "DELETE X"
                count = int(result.split()[-1]) if result else 0
                return count
        except Exception as e:
            logger.error(f"Failed to delete messages: {e}")
            return 0

    async def get_by_message_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get a message by its message_id."""
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM chat_messages WHERE message_id = $1",
                    message_id,
                )
                if row:
                    msg = dict(row)
                    if isinstance(msg.get("sources"), str):
                        msg["sources"] = json.loads(msg["sources"])
                    if isinstance(msg.get("metadata"), str):
                        msg["metadata"] = json.loads(msg["metadata"])
                    return msg
                return None
        except Exception as e:
            logger.error(f"Failed to get message: {e}")
            return None
