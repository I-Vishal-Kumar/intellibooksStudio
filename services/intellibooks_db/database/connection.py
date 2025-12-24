"""Database connection management with Docker/local fallback."""

import asyncio
import logging
from typing import Optional
from pathlib import Path

try:
    import asyncpg
    from asyncpg import Pool
except ImportError:
    asyncpg = None
    Pool = None

from .config import get_db_config, DatabaseConfig

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[Pool] = None
_pool_lock = asyncio.Lock()


async def _try_connect(config: DatabaseConfig, host: str) -> Optional[Pool]:
    """Try to connect to PostgreSQL at the given host."""
    if asyncpg is None:
        logger.warning("asyncpg not installed - database persistence disabled")
        return None

    try:
        pool = await asyncpg.create_pool(
            host=host,
            port=config.port,
            database=config.database,
            user=config.user,
            password=config.password,
            min_size=config.min_pool_size,
            max_size=config.max_pool_size,
            command_timeout=60,
        )
        # Test connection
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        logger.info(f"✅ Connected to PostgreSQL at {host}:{config.port}")
        return pool
    except Exception as e:
        logger.debug(f"Failed to connect to PostgreSQL at {host}: {e}")
        return None


async def get_db_pool() -> Optional[Pool]:
    """Get the database connection pool with Docker/local fallback.

    Tries to connect in order:
    1. Docker container (host: postgres)
    2. Local PostgreSQL (host: localhost)
    3. Returns None if neither available (graceful degradation)
    """
    global _pool

    if _pool is not None:
        return _pool

    async with _pool_lock:
        # Double-check after acquiring lock
        if _pool is not None:
            return _pool

        config = get_db_config()

        # Try Docker first (using 'postgres' hostname from docker-compose)
        logger.info("Attempting to connect to PostgreSQL (Docker)...")
        _pool = await _try_connect(config, "postgres")

        if _pool is None:
            # Try localhost
            logger.info("Docker PostgreSQL not available, trying localhost...")
            _pool = await _try_connect(config, "localhost")

        if _pool is None:
            logger.warning(
                "⚠️ No PostgreSQL available - running without database persistence. "
                "Documents and chat history will not be saved."
            )

        return _pool


async def close_db_pool() -> None:
    """Close the database connection pool."""
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


async def ensure_schema() -> bool:
    """Ensure the database schema exists.

    This is a fallback for when Docker init scripts don't run.
    Returns True if schema exists or was created, False otherwise.
    """
    pool = await get_db_pool()
    if pool is None:
        return False

    try:
        async with pool.acquire() as conn:
            # Check if tables exist
            tables_exist = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'chat_sessions'
                )
            """)

            if tables_exist:
                logger.info("Database schema already exists")
                return True

            # Read and execute the schema file
            schema_path = Path(__file__).parent.parent.parent.parent / \
                "infrastructure" / "docker" / "init-scripts" / "01_init_schema.sql"

            if not schema_path.exists():
                logger.error(f"Schema file not found: {schema_path}")
                return False

            schema_sql = schema_path.read_text()
            await conn.execute(schema_sql)
            logger.info("✅ Database schema created successfully")
            return True

    except Exception as e:
        logger.error(f"Failed to ensure schema: {e}")
        return False


async def health_check() -> dict:
    """Check database health status."""
    pool = await get_db_pool()

    if pool is None:
        return {
            "status": "unavailable",
            "message": "No database connection",
            "persistence_enabled": False,
        }

    try:
        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            pool_size = pool.get_size()

        return {
            "status": "healthy",
            "version": version,
            "pool_size": pool_size,
            "persistence_enabled": True,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "persistence_enabled": False,
        }
