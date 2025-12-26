"""Zoom OAuth provider."""

import base64
import httpx
from urllib.parse import urlencode

from .base import OAuthProvider, TokenResponse, UserInfo
from ..config import get_settings

settings = get_settings()


class ZoomOAuthProvider(OAuthProvider):
    """Zoom OAuth provider for meetings and recordings."""

    name = "zoom"
    authorization_url = "https://zoom.us/oauth/authorize"
    token_url = "https://zoom.us/oauth/token"
    userinfo_url = "https://api.zoom.us/v2/users/me"
    revoke_url = "https://zoom.us/oauth/revoke"

    # Scopes for Zoom
    scopes = [
        "user:read",
        "meeting:read",
        "meeting:write",
        "recording:read",
    ]

    def _get_basic_auth(self) -> str:
        """Get Basic auth header for Zoom."""
        credentials = f"{settings.zoom_client_id}:{settings.zoom_client_secret}"
        return base64.b64encode(credentials.encode()).decode()

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Get the Zoom authorization URL."""
        params = {
            "client_id": settings.zoom_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        return f"{self.authorization_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                headers={
                    "Authorization": f"Basic {self._get_basic_auth()}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            response.raise_for_status()
            data = response.json()

            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                token_type=data.get("token_type", "Bearer"),
                expires_in=data.get("expires_in"),
                scope=data.get("scope"),
            )

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """Refresh an access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                headers={
                    "Authorization": f"Basic {self._get_basic_auth()}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()

            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token", refresh_token),
                token_type=data.get("token_type", "Bearer"),
                expires_in=data.get("expires_in"),
                scope=data.get("scope"),
            )

    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user info from Zoom."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            return UserInfo(
                provider_user_id=data["id"],
                email=data.get("email"),
                name=f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
                extra_data={
                    "account_id": data.get("account_id"),
                    "pmi": data.get("pmi"),
                    "timezone": data.get("timezone"),
                },
            )

    async def revoke_token(self, token: str) -> bool:
        """Revoke an access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.revoke_url,
                headers={
                    "Authorization": f"Basic {self._get_basic_auth()}",
                },
                params={"token": token},
            )
            return response.status_code == 200
