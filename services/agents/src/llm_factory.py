"""LLM Factory - Creates LLM settings from configuration."""

from typing import Dict, Any
from .config import get_settings, LLMProvider


def create_llm_settings() -> Dict[str, Any]:
    """
    Create LLM settings dictionary from configuration.
    
    This centralizes LLM configuration so changes can be made in one place.
    
    Returns:
        Dictionary with LLM settings for BaseAgent
    """
    settings = get_settings()
    
    provider_map = {
        LLMProvider.OPENAI: "openai",
        LLMProvider.ANTHROPIC: "anthropic",
        LLMProvider.OPENROUTER: "openrouter",
    }
    
    provider = provider_map.get(settings.default_llm_provider, "openrouter")
    
    llm_settings = {
        "provider": provider,
        "model": _get_model_for_provider(settings, provider),
    }
    
    # Add API key based on provider
    if provider == "openai":
        llm_settings["api_key"] = settings.openai_api_key
    elif provider == "anthropic":
        llm_settings["api_key"] = settings.anthropic_api_key
    else:  # openrouter
        llm_settings["api_key"] = settings.openrouter_api_key
        llm_settings["base_url"] = "https://openrouter.ai/api/v1"
    
    return llm_settings


def _get_model_for_provider(settings, provider: str) -> str:
    """Get the appropriate model name for the provider."""
    if provider == "openai":
        return "gpt-4o"
    elif provider == "anthropic":
        return "claude-sonnet-4-20250514"
    else:  # openrouter
        return settings.openrouter_model

