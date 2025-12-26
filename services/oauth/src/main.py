"""OAuth Service - Main FastAPI application."""

import json
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import init_db, get_db
from .models import UserIntegration, OAuthState
from .encryption import encrypt_token, decrypt_token
from .providers import get_provider, PROVIDERS

settings = get_settings()

app = FastAPI(
    title="OAuth Service",
    description="OAuth integration service for Intellibooks Studio",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Schemas
# ============================================

class IntegrationStatus(BaseModel):
    """Integration connection status."""
    provider: str
    connected: bool
    email: Optional[str] = None
    name: Optional[str] = None
    connected_at: Optional[datetime] = None


class AllIntegrationsResponse(BaseModel):
    """Response with all integration statuses."""
    integrations: list[IntegrationStatus]


class ConnectRequest(BaseModel):
    """Request to start OAuth flow."""
    provider: str
    redirect_url: Optional[str] = None


class TokenRequest(BaseModel):
    """Request to get a token for MCP server."""
    provider: str
    user_id: str


class TokenResponse(BaseModel):
    """Response with decrypted token."""
    access_token: str
    provider: str
    expires_at: Optional[datetime] = None


# ============================================
# Startup
# ============================================

@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    await init_db()


# ============================================
# Health Check
# ============================================

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "oauth"}


# ============================================
# Integration Status Endpoints
# ============================================

@app.get("/api/integrations/{user_id}", response_model=AllIntegrationsResponse)
async def get_integrations(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all integration statuses for a user."""
    # Get all connected integrations
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.is_active == True,
        )
    )
    connected = {i.provider: i for i in result.scalars().all()}

    # Build status for all providers
    integrations = []
    for provider_name in PROVIDERS.keys():
        if provider_name in connected:
            integration = connected[provider_name]
            integrations.append(IntegrationStatus(
                provider=provider_name,
                connected=True,
                email=integration.provider_email,
                name=integration.provider_data,
                connected_at=integration.created_at,
            ))
        else:
            integrations.append(IntegrationStatus(
                provider=provider_name,
                connected=False,
            ))

    return AllIntegrationsResponse(integrations=integrations)


# ============================================
# OAuth Flow Endpoints
# ============================================

@app.get("/api/oauth/{provider}/connect")
async def start_oauth(
    provider: str,
    user_id: str = Query(..., description="User ID from auth system"),
    redirect_url: Optional[str] = Query(None, description="URL to redirect after completion"),
    db: AsyncSession = Depends(get_db),
):
    """Start OAuth flow - redirects to provider's authorization page."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    # Generate state token
    state = secrets.token_urlsafe(32)

    # Save state to database
    oauth_state = OAuthState(
        state=state,
        user_id=user_id,
        provider=provider,
        redirect_url=redirect_url or f"{settings.frontend_url}/settings/integrations",
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(oauth_state)
    await db.commit()

    # Get provider and authorization URL
    oauth_provider = get_provider(provider)
    redirect_uri = f"{settings.base_url}/api/oauth/{provider}/callback"
    auth_url = oauth_provider.get_authorization_url(state, redirect_uri)

    return RedirectResponse(url=auth_url)


@app.get("/api/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """OAuth callback - exchanges code for tokens and stores them."""
    # Handle error from provider
    if error:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/integrations?error={error}"
        )

    # Verify state
    result = await db.execute(
        select(OAuthState).where(
            OAuthState.state == state,
            OAuthState.provider == provider,
            OAuthState.expires_at > datetime.utcnow(),
        )
    )
    oauth_state = result.scalar_one_or_none()

    if not oauth_state:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/integrations?error=invalid_state"
        )

    user_id = oauth_state.user_id
    redirect_url = oauth_state.redirect_url

    # Delete the used state
    await db.execute(delete(OAuthState).where(OAuthState.state == state))

    try:
        # Exchange code for tokens
        oauth_provider = get_provider(provider)
        redirect_uri = f"{settings.base_url}/api/oauth/{provider}/callback"
        tokens = await oauth_provider.exchange_code(code, redirect_uri)

        # Get user info
        user_info = await oauth_provider.get_user_info(tokens.access_token)

        # Calculate expiration time
        expires_at = None
        if tokens.expires_in:
            expires_at = datetime.utcnow() + timedelta(seconds=tokens.expires_in)

        # Check if integration already exists
        result = await db.execute(
            select(UserIntegration).where(
                UserIntegration.user_id == user_id,
                UserIntegration.provider == provider,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing integration
            existing.access_token = encrypt_token(tokens.access_token)
            existing.refresh_token = encrypt_token(tokens.refresh_token) if tokens.refresh_token else None
            existing.token_type = tokens.token_type
            existing.expires_at = expires_at
            existing.scope = tokens.scope
            existing.provider_user_id = user_info.provider_user_id
            existing.provider_email = user_info.email
            existing.provider_data = user_info.name
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
        else:
            # Create new integration
            integration = UserIntegration(
                user_id=user_id,
                provider=provider,
                access_token=encrypt_token(tokens.access_token),
                refresh_token=encrypt_token(tokens.refresh_token) if tokens.refresh_token else None,
                token_type=tokens.token_type,
                expires_at=expires_at,
                scope=tokens.scope,
                provider_user_id=user_info.provider_user_id,
                provider_email=user_info.email,
                provider_data=user_info.name,
                is_active=True,
            )
            db.add(integration)

        await db.commit()

        # Redirect back to frontend with success
        return RedirectResponse(
            url=f"{redirect_url}?success=true&provider={provider}"
        )

    except Exception as e:
        return RedirectResponse(
            url=f"{redirect_url}?error={str(e)}"
        )


@app.delete("/api/oauth/{provider}/disconnect")
async def disconnect_integration(
    provider: str,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect an integration."""
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == provider,
        )
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Try to revoke token
    try:
        oauth_provider = get_provider(provider)
        access_token = decrypt_token(integration.access_token)
        await oauth_provider.revoke_token(access_token)
    except Exception:
        pass  # Ignore revocation errors

    # Delete integration
    await db.delete(integration)
    await db.commit()

    return {"status": "disconnected", "provider": provider}


# ============================================
# Token Retrieval for MCP Servers
# ============================================

@app.post("/api/tokens/get", response_model=TokenResponse)
async def get_token(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Get decrypted token for MCP server to use.

    This endpoint is called by MCP servers to get user tokens.
    Should be protected in production (internal network only).
    """
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == request.user_id,
            UserIntegration.provider == request.provider,
            UserIntegration.is_active == True,
        )
    )
    integration = result.scalar_one_or_none()

    if not integration:
        raise HTTPException(
            status_code=404,
            detail=f"No active {request.provider} integration for user"
        )

    # Check if token is expired and refresh if needed
    if integration.expires_at and integration.expires_at < datetime.utcnow():
        if integration.refresh_token:
            try:
                oauth_provider = get_provider(request.provider)
                refresh_token = decrypt_token(integration.refresh_token)
                new_tokens = await oauth_provider.refresh_access_token(refresh_token)

                # Update tokens
                integration.access_token = encrypt_token(new_tokens.access_token)
                if new_tokens.refresh_token:
                    integration.refresh_token = encrypt_token(new_tokens.refresh_token)
                if new_tokens.expires_in:
                    integration.expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.expires_in)

                await db.commit()
            except Exception as e:
                raise HTTPException(
                    status_code=401,
                    detail=f"Token refresh failed: {str(e)}. Please reconnect."
                )
        else:
            raise HTTPException(
                status_code=401,
                detail="Token expired and no refresh token available. Please reconnect."
            )

    return TokenResponse(
        access_token=decrypt_token(integration.access_token),
        provider=request.provider,
        expires_at=integration.expires_at,
    )


# ============================================
# Available Providers
# ============================================

@app.get("/api/providers")
async def list_providers():
    """List all available OAuth providers."""
    providers = []
    for name, provider_class in PROVIDERS.items():
        provider = provider_class()
        providers.append({
            "name": name,
            "display_name": name.replace("_", " ").title(),
            "scopes": provider.scopes,
        })
    return {"providers": providers}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
