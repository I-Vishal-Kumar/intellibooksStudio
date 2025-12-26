"""Configuration for OAuth Service."""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """OAuth Service configuration."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    service_name: str = "oauth-service"
    host: str = "0.0.0.0"
    port: int = 8008
    debug: bool = False

    # Base URL for callbacks
    base_url: str = "http://localhost:8008"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://admin:devpassword123@localhost:5433/intellibooks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Encryption key for tokens (generate with: openssl rand -hex 32)
    encryption_key: str = "your-encryption-key-here-please-change-in-production"

    # JWT Secret
    jwt_secret: str = "your-jwt-secret-here-please-change-in-production"

    # ============================================
    # OAuth Provider Credentials (App-level)
    # These are YOUR app's credentials, not user's
    # ============================================

    # Google (Gmail, Drive)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Zoom
    zoom_client_id: str = ""
    zoom_client_secret: str = ""

    # ClickUp
    clickup_client_id: str = ""
    clickup_client_secret: str = ""

    # Zoho (Mail, Cliq)
    zoho_client_id: str = ""
    zoho_client_secret: str = ""

    # Azure DevOps
    azure_devops_client_id: str = ""
    azure_devops_client_secret: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()
