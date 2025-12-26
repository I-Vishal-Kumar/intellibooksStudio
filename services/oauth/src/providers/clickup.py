"""ClickUp OAuth provider."""

import httpx
from urllib.parse import urlencode

from .base import OAuthProvider, TokenResponse, UserInfo
from ..config import get_settings

settings = get_settings()


class ClickUpOAuthProvider(OAuthProvider):
    """ClickUp OAuth provider for task management."""

    name = "clickup"
    authorization_url = "https://app.clickup.com/api"
    token_url = "https://api.clickup.com/api/v2/oauth/token"
    userinfo_url = "https://api.clickup.com/api/v2/user"

    scopes = []  # ClickUp doesn't use scopes in OAuth

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Get the ClickUp authorization URL."""
        params = {
            "client_id": settings.clickup_client_id,
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"{self.authorization_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                params={
                    "client_id": settings.clickup_client_id,
                    "client_secret": settings.clickup_client_secret,
                    "code": code,
                },
            )
            response.raise_for_status()
            data = response.json()

            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=None,  # ClickUp tokens don't expire
                token_type="Bearer",
                expires_in=None,
                scope=None,
            )

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """ClickUp tokens don't expire, so this is not needed."""
        raise NotImplementedError("ClickUp tokens don't expire")

    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user info from ClickUp."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": access_token},
            )
            response.raise_for_status()
            data = response.json()
            user = data.get("user", {})

            return UserInfo(
                provider_user_id=str(user.get("id")),
                email=user.get("email"),
                name=user.get("username"),
                extra_data={
                    "color": user.get("color"),
                    "profilePicture": user.get("profilePicture"),
                },
            )

    async def revoke_token(self, token: str) -> bool:
        """ClickUp doesn't have a revoke endpoint - return True."""
        return True
