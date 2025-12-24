"""Shared services module for cross-service functionality."""

from .database import get_db_pool, DatabaseConfig

__all__ = ["get_db_pool", "DatabaseConfig"]
