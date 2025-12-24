"""Database configuration with environment variable support."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class DatabaseConfig:
    """PostgreSQL database configuration."""

    host: str = "localhost"
    port: int = 5433  # Using 5433 to avoid conflict with local PostgreSQL
    database: str = "intellibooks"
    user: str = "admin"
    password: str = "devpassword123"
    min_pool_size: int = 2
    max_pool_size: int = 10

    @property
    def dsn(self) -> str:
        """Get the database connection string."""
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


def get_db_config() -> DatabaseConfig:
    """Get database configuration from environment variables.

    Falls back to defaults suitable for local development.
    """
    # Try to load .env from project root
    try:
        from dotenv import load_dotenv

        project_root = Path(__file__).parent.parent.parent.parent
        env_path = project_root / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass

    return DatabaseConfig(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),  # Docker port 5433 to avoid conflict
        database=os.getenv("POSTGRES_DB", "intellibooks"),
        user=os.getenv("POSTGRES_USER", "admin"),
        password=os.getenv("POSTGRES_PASSWORD", "devpassword123"),
        min_pool_size=int(os.getenv("POSTGRES_MIN_POOL_SIZE", "2")),
        max_pool_size=int(os.getenv("POSTGRES_MAX_POOL_SIZE", "10")),
    )
