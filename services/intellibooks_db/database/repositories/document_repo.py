"""Repository for document operations."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

try:
    from asyncpg import Pool
except ImportError:
    Pool = None

logger = logging.getLogger(__name__)


class DocumentRepository:
    """Repository for document CRUD operations."""

    def __init__(self, pool: Pool):
        self.pool = pool

    async def create(
        self,
        document_id: str,
        session_id: str,
        filename: str,
        file_type: str,
        file_extension: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        chunks_count: int = 0,
        total_chars: int = 0,
        content_hash: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a new document record."""
        try:
            async with self.pool.acquire() as conn:
                # First get the session's UUID
                session_uuid = await conn.fetchval(
                    "SELECT id FROM chat_sessions WHERE session_id = $1",
                    session_id,
                )
                if not session_uuid:
                    logger.error(f"Session not found: {session_id}")
                    return None

                import json
                row = await conn.fetchrow(
                    """
                    INSERT INTO documents (
                        document_id, session_id, filename, file_type,
                        file_extension, file_size_bytes, chunks_count,
                        total_chars, content_hash, extra_metadata, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'processing')
                    ON CONFLICT (document_id) DO UPDATE SET
                        filename = EXCLUDED.filename,
                        file_type = EXCLUDED.file_type,
                        updated_at = NOW()
                    RETURNING *
                    """,
                    document_id,
                    session_uuid,
                    filename,
                    file_type,
                    file_extension,
                    file_size_bytes,
                    chunks_count,
                    total_chars,
                    content_hash,
                    json.dumps(extra_metadata or {}),
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to create document: {e}")
            return None

    async def update_status(
        self,
        document_id: str,
        status: str,
        chunks_count: Optional[int] = None,
        total_chars: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> bool:
        """Update document processing status."""
        try:
            async with self.pool.acquire() as conn:
                if status == "ready":
                    result = await conn.execute(
                        """
                        UPDATE documents
                        SET status = $2,
                            chunks_count = COALESCE($3, chunks_count),
                            total_chars = COALESCE($4, total_chars),
                            processed_at = NOW(),
                            updated_at = NOW()
                        WHERE document_id = $1
                        """,
                        document_id,
                        status,
                        chunks_count,
                        total_chars,
                    )
                elif status == "error":
                    result = await conn.execute(
                        """
                        UPDATE documents
                        SET status = $2,
                            error_message = $3,
                            updated_at = NOW()
                        WHERE document_id = $1
                        """,
                        document_id,
                        status,
                        error_message,
                    )
                else:
                    result = await conn.execute(
                        """
                        UPDATE documents
                        SET status = $2, updated_at = NOW()
                        WHERE document_id = $1
                        """,
                        document_id,
                        status,
                    )
                return "UPDATE 1" in result
        except Exception as e:
            logger.error(f"Failed to update document status: {e}")
            return False

    async def get_by_document_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by its document_id."""
        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT d.*, cs.session_id as session_string_id
                    FROM documents d
                    JOIN chat_sessions cs ON d.session_id = cs.id
                    WHERE d.document_id = $1
                    """,
                    document_id,
                )
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to get document: {e}")
            return None

    async def get_by_session(
        self,
        session_id: str,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get all documents for a session."""
        try:
            async with self.pool.acquire() as conn:
                if status:
                    rows = await conn.fetch(
                        """
                        SELECT d.*
                        FROM documents d
                        JOIN chat_sessions cs ON d.session_id = cs.id
                        WHERE cs.session_id = $1 AND d.status = $2
                        ORDER BY d.created_at DESC
                        """,
                        session_id,
                        status,
                    )
                else:
                    rows = await conn.fetch(
                        """
                        SELECT d.*
                        FROM documents d
                        JOIN chat_sessions cs ON d.session_id = cs.id
                        WHERE cs.session_id = $1
                        ORDER BY d.created_at DESC
                        """,
                        session_id,
                    )
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to get documents for session: {e}")
            return []

    async def list_all(
        self,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List all documents."""
        try:
            async with self.pool.acquire() as conn:
                if status:
                    rows = await conn.fetch(
                        """
                        SELECT d.*, cs.session_id as session_string_id
                        FROM documents d
                        JOIN chat_sessions cs ON d.session_id = cs.id
                        WHERE d.status = $1
                        ORDER BY d.created_at DESC
                        LIMIT $2 OFFSET $3
                        """,
                        status,
                        limit,
                        offset,
                    )
                else:
                    rows = await conn.fetch(
                        """
                        SELECT d.*, cs.session_id as session_string_id
                        FROM documents d
                        JOIN chat_sessions cs ON d.session_id = cs.id
                        ORDER BY d.created_at DESC
                        LIMIT $1 OFFSET $2
                        """,
                        limit,
                        offset,
                    )
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to list documents: {e}")
            return []

    async def delete(self, document_id: str) -> bool:
        """Delete a document by its document_id."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM documents WHERE document_id = $1",
                    document_id,
                )
                return "DELETE 1" in result
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            return False

    async def get_session_document_ids(self, session_id: str) -> List[str]:
        """Get all document IDs for a session (for RAG filtering)."""
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT d.document_id
                    FROM documents d
                    JOIN chat_sessions cs ON d.session_id = cs.id
                    WHERE cs.session_id = $1 AND d.status = 'ready'
                    """,
                    session_id,
                )
                return [row["document_id"] for row in rows]
        except Exception as e:
            logger.error(f"Failed to get session document IDs: {e}")
            return []

    async def delete_all(self) -> bool:
        """Delete all documents from the database."""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute("DELETE FROM documents")
                deleted_count = int(result.split()[-1]) if result else 0
                logger.info(f"Deleted {deleted_count} documents from database")
                return True
        except Exception as e:
            logger.error(f"Failed to delete all documents: {e}")
            return False
