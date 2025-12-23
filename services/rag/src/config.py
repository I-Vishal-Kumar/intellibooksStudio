"""Configuration for RAG Service."""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """RAG Service configuration."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra fields from other services' .env entries
    )

    # Service
    service_name: str = "rag-service"
    host: str = "0.0.0.0"
    port: int = 8002
    debug: bool = False

    # Database
    database_url: str = "postgresql://admin:password@localhost:5432/intellibooks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Chroma
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    chroma_collection: str = "intellibooks_knowledge"

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


@lru_cache()
def get_settings() -> Settings:
    return Settings()
