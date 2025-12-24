"""Database module for PostgreSQL persistence.

Provides connection pooling with Docker/local fallback pattern (like ChromaDB).
"""

from .config import DatabaseConfig, get_db_config
from .connection import get_db_pool, close_db_pool, ensure_schema, health_check
from .repositories import SessionRepository, DocumentRepository, MessageRepository

__all__ = [
    "DatabaseConfig",
    "get_db_config",
    "get_db_pool",
    "close_db_pool",
    "ensure_schema",
    "health_check",
    "SessionRepository",
    "DocumentRepository",
    "MessageRepository",
]
