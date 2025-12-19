"""Configuration for Agent Service."""

from pydantic_settings import BaseSettings
from enum import Enum
from functools import lru_cache
from pathlib import Path


class WhisperModel(str, Enum):
    TINY = "tiny"
    BASE = "base"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OPENROUTER = "openrouter"


def _find_env_file() -> str:
    """Find .env file, checking service dir first, then project root."""
    # Check service directory
    service_env = Path(__file__).parent.parent / ".env"
    if service_env.exists():
        return str(service_env)

    # Check project root (services/agents/src -> project root)
    root_env = Path(__file__).parent.parent.parent.parent / ".env"
    if root_env.exists():
        return str(root_env)

    return ".env"


class Settings(BaseSettings):
    """Agent Service configuration."""

    # Service
    service_name: str = "agent-service"
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False

    # Database
    database_url: str = "postgresql://admin:password@localhost:5432/intellibooks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # RAG Service
    rag_service_url: str = "http://localhost:8002"

    # LLM Providers
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    default_llm_provider: LLMProvider = LLMProvider.OPENROUTER
    openrouter_model: str = "anthropic/claude-sonnet-4"

    # Whisper
    whisper_model: WhisperModel = WhisperModel.BASE

    # Storage
    audio_storage_path: str = "./data/audio"
    upload_storage_path: str = "./data/uploads"
    max_audio_size_mb: int = 100

    class Config:
        env_file = _find_env_file()
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields from .env file


@lru_cache()
def get_settings() -> Settings:
    return Settings()
