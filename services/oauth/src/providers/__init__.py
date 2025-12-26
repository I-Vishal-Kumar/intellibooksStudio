"""OAuth providers."""

from .base import OAuthProvider
from .google import GoogleOAuthProvider
from .zoom import ZoomOAuthProvider
from .clickup import ClickUpOAuthProvider
from .zoho import ZohoOAuthProvider

# Provider registry
PROVIDERS = {
    "google": GoogleOAuthProvider,
    "zoom": ZoomOAuthProvider,
    "clickup": ClickUpOAuthProvider,
    "zoho": ZohoOAuthProvider,
}


def get_provider(provider_name: str) -> OAuthProvider:
    """Get OAuth provider instance by name."""
    provider_class = PROVIDERS.get(provider_name)
    if not provider_class:
        raise ValueError(f"Unknown provider: {provider_name}")
    return provider_class()
