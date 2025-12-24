"""Factory for creating database providers."""

import logging
from typing import Optional

from .base import DatabaseProvider, DatabaseConfig, DatabaseType
from .postgresql_provider import PostgreSQLProvider

logger = logging.getLogger(__name__)


def create_database_provider(config: DatabaseConfig) -> DatabaseProvider:
    """
    Create a database provider based on configuration.
    
    Args:
        config: Database configuration
        
    Returns:
        DatabaseProvider instance
        
    Raises:
        ValueError: If database type is not supported
    """
    if config.db_type == DatabaseType.POSTGRESQL:
        return PostgreSQLProvider(config)
    elif config.db_type == DatabaseType.SNOWFLAKE:
        # TODO: Implement SnowflakeProvider
        raise NotImplementedError("Snowflake provider not yet implemented")
    elif config.db_type == DatabaseType.MYSQL:
        # TODO: Implement MySQLProvider
        raise NotImplementedError("MySQL provider not yet implemented")
    elif config.db_type == DatabaseType.SQLITE:
        # TODO: Implement SQLiteProvider
        raise NotImplementedError("SQLite provider not yet implemented")
    else:
        raise ValueError(f"Unsupported database type: {config.db_type}")

