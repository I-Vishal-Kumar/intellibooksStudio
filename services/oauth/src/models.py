"""Database models for OAuth token storage."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class UserIntegration(Base):
    """Stores OAuth tokens for each user's connected integrations."""

    __tablename__ = "user_integrations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # User identifier (from Clerk or your auth system)
    user_id = Column(String(255), nullable=False, index=True)

    # Integration provider (google, zoom, clickup, zoho, azure_devops)
    provider = Column(String(50), nullable=False)

    # OAuth tokens (encrypted)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)

    # Token metadata
    token_type = Column(String(50), default="Bearer")
    expires_at = Column(DateTime, nullable=True)
    scope = Column(Text, nullable=True)

    # Provider-specific data (e.g., email, account ID)
    provider_user_id = Column(String(255), nullable=True)
    provider_email = Column(String(255), nullable=True)
    provider_data = Column(Text, nullable=True)  # JSON string for extra data

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: one integration per provider per user
    __table_args__ = (
        UniqueConstraint('user_id', 'provider', name='uq_user_provider'),
    )


class OAuthState(Base):
    """Temporary storage for OAuth state during authorization flow."""

    __tablename__ = "oauth_states"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # State token (random string)
    state = Column(String(255), unique=True, nullable=False, index=True)

    # User and provider info
    user_id = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)

    # Redirect URL after completion
    redirect_url = Column(Text, nullable=True)

    # Expiration (states should be short-lived)
    expires_at = Column(DateTime, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
