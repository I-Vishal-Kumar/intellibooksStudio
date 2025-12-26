"""Zoho OAuth provider for Mail and Cliq."""

import httpx
from urllib.parse import urlencode

from .base import OAuthProvider, TokenResponse, UserInfo
from ..config import get_settings

settings = get_settings()


class ZohoOAuthProvider(OAuthProvider):
    """Zoho OAuth provider for Mail and Cliq."""

    name = "zoho"
    authorization_url = "https://accounts.zoho.com/oauth/v2/auth"
    token_url = "https://accounts.zoho.com/oauth/v2/token"
    userinfo_url = "https://accounts.zoho.com/oauth/user/info"
    revoke_url = "https://accounts.zoho.com/oauth/v2/token/revoke"

    # Scopes for Zoho Mail and Cliq
    scopes = [
        "ZohoMail.messages.READ",
        "ZohoMail.messages.CREATE",
        "ZohoCliq.Webhooks.READ",
        "ZohoCliq.Webhooks.CREATE",
        "ZohoCliq.Messages.READ",
        "ZohoCliq.Messages.CREATE",
        "profile",
        "email",
    ]

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        """Get the Zoho authorization URL."""
        params = {
            "client_id": settings.zoho_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": ",".join(self.scopes),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{self.authorization_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenResponse:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data={
                    "client_id": settings.zoho_client_id,
                    "client_secret": settings.zoho_client_secret,
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
                    "client_id": settings.zoho_client_id,
                    "client_secret": settings.zoho_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()

            return TokenResponse(
                access_token=data["access_token"],
                refresh_token=refresh_token,
                token_type=data.get("token_type", "Bearer"),
                expires_in=data.get("expires_in"),
                scope=data.get("scope"),
            )

    async def get_user_info(self, access_token: str) -> UserInfo:
        """Get user info from Zoho."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            return UserInfo(
                provider_user_id=data.get("ZUID", ""),
                email=data.get("Email"),
                name=f"{data.get('First_Name', '')} {data.get('Last_Name', '')}".strip(),
                extra_data={
                    "display_name": data.get("Display_Name"),
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
