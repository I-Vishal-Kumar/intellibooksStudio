"""Redis client for meeting session storage and background processing."""

import json
import logging
from typing import Optional, Dict, Any, List
import redis.asyncio as aioredis
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Global Redis connection pool
_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    """Get or create Redis client."""
    global _redis_client
    
    if _redis_client is None:
        if not settings.redis_enabled:
            raise RuntimeError("Redis is not enabled in settings")
        
        try:
            _redis_client = await aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            await _redis_client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    return _redis_client


async def close_redis_client():
    """Close Redis connection."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")


# Redis key prefixes
SESSION_PREFIX = "meeting:session:"
CHUNK_QUEUE_PREFIX = "meeting:chunks:"
PROCESSING_STATE_PREFIX = "meeting:processing:"
METADATA_PREFIX = "meeting:metadata:"


async def save_session(session_id: str, session_data: Dict[str, Any]) -> None:
    """Save session data to Redis."""
    redis = await get_redis_client()
    key = f"{SESSION_PREFIX}{session_id}"
    await redis.setex(key, 86400 * 7, json.dumps(session_data))  # 7 days TTL


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session data from Redis."""
    redis = await get_redis_client()
    key = f"{SESSION_PREFIX}{session_id}"
    data = await redis.get(key)
    if data:
        return json.loads(data)
    return None


async def update_session_field(session_id: str, field: str, value: Any) -> None:
    """Update a specific field in session data."""
    session = await get_session(session_id)
    if session:
        session[field] = value
        await save_session(session_id, session)


async def add_chunk_to_queue(session_id: str, chunk_data: Dict[str, Any]) -> None:
    """Add chunk to Redis queue."""
    redis = await get_redis_client()
    key = f"{CHUNK_QUEUE_PREFIX}{session_id}"
    await redis.rpush(key, json.dumps(chunk_data))
    # Set TTL for queue (7 days)
    await redis.expire(key, 86400 * 7)


async def get_chunks_from_queue(session_id: str) -> List[Dict[str, Any]]:
    """Get all chunks from queue."""
    redis = await get_redis_client()
    key = f"{CHUNK_QUEUE_PREFIX}{session_id}"
    chunks = await redis.lrange(key, 0, -1)
    return [json.loads(chunk) for chunk in chunks]


async def clear_chunk_queue(session_id: str) -> None:
    """Clear chunk queue for session."""
    redis = await get_redis_client()
    key = f"{CHUNK_QUEUE_PREFIX}{session_id}"
    await redis.delete(key)


async def save_processing_state(session_id: str, state: Dict[str, Any]) -> None:
    """Save background processing state to Redis."""
    redis = await get_redis_client()
    key = f"{PROCESSING_STATE_PREFIX}{session_id}"
    await redis.setex(key, 86400 * 7, json.dumps(state))  # 7 days TTL


async def get_processing_state(session_id: str) -> Optional[Dict[str, Any]]:
    """Get background processing state from Redis."""
    redis = await get_redis_client()
    key = f"{PROCESSING_STATE_PREFIX}{session_id}"
    data = await redis.get(key)
    if data:
        return json.loads(data)
    return None


async def save_metadata(session_id: str, metadata: Dict[str, Any]) -> None:
    """Save meeting metadata to Redis."""
    redis = await get_redis_client()
    key = f"{METADATA_PREFIX}{session_id}"
    await redis.setex(key, 86400 * 30, json.dumps(metadata))  # 30 days TTL


async def get_metadata(session_id: str) -> Optional[Dict[str, Any]]:
    """Get meeting metadata from Redis."""
    redis = await get_redis_client()
    key = f"{METADATA_PREFIX}{session_id}"
    data = await redis.get(key)
    if data:
        return json.loads(data)
    return None

