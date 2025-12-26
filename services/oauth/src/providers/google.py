"""Google OAuth provider for Gmail and Drive."""

import httpx
from urllib.parse import urlencode

from .base import OAuthProvider, TokenResponse, UserInfo
from ..config import get_settings

settings = get_settings()


class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth provider for Gmail and Drive access."""

    name = "google"
    authorization_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    revoke_url = "https://oauth2.googleapis.com/revoke"

    # Scopes for Gmail and Drive
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file",
    ]

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Get the Google authorization URL."""
        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",  # To get refresh token
            "prompt": "consent",  # Force consent to always get refresh token
        }
        return f"{self.authorization_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
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
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()

            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=refresh_token,  # Keep the same refresh token
                token_type=data.get("token_type", "Bearer"),
                expires_in=data.get("expires_in"),
                scope=data.get("scope"),
            )

    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user info from Google."""
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
                name=data.get("name"),
                extra_data={
                    "picture": data.get("picture"),
                    "verified_email": data.get("verified_email"),
                },
            )

    async def revoke_token(self, token: str) -> bool:
        """Revoke an access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.revoke_url,
                params={"token": token},
            )
            return response.status_code == 200
