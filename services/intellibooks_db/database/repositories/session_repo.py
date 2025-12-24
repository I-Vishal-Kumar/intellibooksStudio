"""Repository for chat session operations."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

try:
    from asyncpg import Pool
except ImportError:
    Pool = None

logger = logging.getLogger(__name__)


class SessionRepository:
    """Repository for chat session CRUD operations."""

    def __init__(self, pool: Pool):
        self.pool = pool

    async def create(
        self,
        session_id: str,
        title: str = "New Notebook",
    ) -> Optional[Dict[str, Any]]:
        """Create a new chat session (notebook)."""
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO chat_sessions (session_id, title)
                    VALUES ($1, $2)
                    ON CONFLICT (session_id) DO UPDATE SET
                        updated_at = NOW()
                    RETURNING id, session_id, title, is_active, created_at, updated_at
                    """,
                    session_id,
                    title,
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            return None

    async def get_by_session_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a session by its session_id."""
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT s.*,
                           COUNT(DISTINCT d.id) as document_count,
                           COUNT(DISTINCT m.id) as message_count
                    FROM chat_sessions s
                    LEFT JOIN documents d ON s.id = d.session_id
                    LEFT JOIN chat_messages m ON s.id = m.session_id
                    WHERE s.session_id = $1
                    GROUP BY s.id
                    """,
                    session_id,
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session: {e}")
            return None

    async def get_by_id(self, id: UUID) -> Optional[Dict[str, Any]]:
        """Get a session by its UUID."""
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT s.*,
                           COUNT(DISTINCT d.id) as document_count,
                           COUNT(DISTINCT m.id) as message_count
                    FROM chat_sessions s
                    LEFT JOIN documents d ON s.id = d.session_id
                    LEFT JOIN chat_messages m ON s.id = m.session_id
                    WHERE s.id = $1
                    GROUP BY s.id
                    """,
                    id,
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get session by id: {e}")
            return None

    async def list_all(
        self,
        include_inactive: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List all sessions with document and message counts."""
        try:
            async with self.pool.acquire() as conn:
                query = """
                    SELECT s.*,
                           COUNT(DISTINCT d.id) as document_count,
                           COUNT(DISTINCT m.id) as message_count,
                           MAX(m.created_at) as last_message_at
                    FROM chat_sessions s
                    LEFT JOIN documents d ON s.id = d.session_id
                    LEFT JOIN chat_messages m ON s.id = m.session_id
                """
                if not include_inactive:
                    query += " WHERE s.is_active = true"
                query += """
                    GROUP BY s.id
                    ORDER BY COALESCE(MAX(m.created_at), s.updated_at) DESC
                    LIMIT $1 OFFSET $2
                """
                rows = await conn.fetch(query, limit, offset)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to list sessions: {e}")
            return []

    async def update_title(self, session_id: str, title: str) -> bool:
        """Update a session's title."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE chat_sessions
                    SET title = $2, updated_at = NOW()
                    WHERE session_id = $1
                    """,
                    session_id,
                    title,
                )
                return "UPDATE 1" in result
        except Exception as e:
            logger.error(f"Failed to update session title: {e}")
            return False

    async def delete(self, session_id: str) -> bool:
        """Delete a session (cascades to documents and messages)."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM chat_sessions WHERE session_id = $1",
                    session_id,
                )
                return "DELETE 1" in result
        except Exception as e:
            logger.error(f"Failed to delete session: {e}")
            return False

    async def set_inactive(self, session_id: str) -> bool:
        """Mark a session as inactive (soft delete)."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE chat_sessions
                    SET is_active = false, updated_at = NOW()
                    WHERE session_id = $1
                    """,
                    session_id,
                )
                return "UPDATE 1" in result
        except Exception as e:
            logger.error(f"Failed to set session inactive: {e}")
            return False

    async def get_or_create(
        self,
        session_id: str,
        title: str = "New Notebook",
    ) -> Optional[Dict[str, Any]]:
        """Get an existing session or create a new one."""
        session = await self.get_by_session_id(session_id)
        if session:
            return session
        return await self.create(session_id, title)
