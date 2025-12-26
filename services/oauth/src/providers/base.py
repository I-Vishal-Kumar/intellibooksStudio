"""Base OAuth provider class."""

from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel


class TokenResponse(BaseModel):
    """OAuth token response."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: Optional[int] = None
    scope: Optional[str] = None


class UserInfo(BaseModel):
    """User info from OAuth provider."""
    provider_user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    extra_data: Optional[dict] = None


class OAuthProvider(ABC):
    """Base class for OAuth providers."""

    name: str = "base"
    authorization_url: str = ""
    token_url: str = ""
    userinfo_url: str = ""
    scopes: list[str] = []

    @abstractmethod
    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Get the authorization URL for the OAuth flow."""
        pass

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for tokens."""
        pass

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """Refresh an access token."""
        pass

    @abstractmethod
    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user info from the provider."""
        pass

    @abstractmethod
    async def revoke_token(self, token: str) -> bool:
        """Revoke an access token."""
        pass
