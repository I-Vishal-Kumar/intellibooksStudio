"""Configuration for RAG Service."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """RAG Service configuration."""

    # Service
    service_name: str = "rag-service"
    host: str = "0.0.0.0"
    port: int = 8002
    debug: bool = False

    # Database
    database_url: str = "postgresql://admin:password@localhost:5432/audio_insight"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Chroma
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_collection: str = "audio_insight_transcripts"

    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    default_llm_provider: str = "openrouter"
    openrouter_model: str = "anthropic/claude-sonnet-4"

    # RAG Settings
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k_results: int = 5

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
