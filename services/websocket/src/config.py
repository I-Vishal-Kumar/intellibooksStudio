"""Configuration for WebSocket Service."""

import json
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


def get_ports_config():
    """Load ports configuration from core package."""
    # Path to ports.json in core package
    core_path = Path(__file__).parent.parent.parent.parent / "packages" / "core" / "ports.json"
    
    if not core_path.exists():
        # Fallback to default ports if file doesn't exist
        return {
            "services": {"websocket": 8004},
            "apps": {"ui": 3001},
            "infrastructure": {"redis": 6379},
        }
    
    with open(core_path, "r") as f:
        return json.load(f)


class Settings(BaseSettings):
    """WebSocket Service configuration."""

    # Service
    service_name: str = "websocket-service"
    host: str = "0.0.0.0"
    port: int = 8004  # Will be overridden by ports.json
    debug: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379"
    redis_enabled: bool = True

    # Agent Service (for future integration)
    agent_service_url: str = "http://localhost:8001"

    # CORS
    cors_origins: list[str] = ["http://localhost:3001", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Override port from ports.json
        ports_config = get_ports_config()
        if "services" in ports_config and "websocket" in ports_config["services"]:
            self.port = ports_config["services"]["websocket"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()

