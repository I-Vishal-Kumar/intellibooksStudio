"""Database models for chat persistence."""

import uuid
from datetime import datetime
from typing import List, Optional, Any
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum, JSON, Uuid
from sqlalchemy.orm import declarative_base, relationship, Session

Base = declarative_base()


class Conversation(Base):
    """Conversation model."""
    __tablename__ = "conversations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)  # Clerk User ID
    title = Column(String, nullable=True)
    document_ids = Column(JSON, default=list)  # List of document IDs for context
    
    # Public Sharing
    is_public = Column(Boolean, default=False)
    share_token = Column(String, unique=True, nullable=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
    permissions = relationship("ConversationPermission", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message model."""
    __tablename__ = "messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSON, default=dict)  # 'metadata' is reserved in SQLAlchemy Base
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class ConversationPermission(Base):
    """Permissions for specific users on a conversation."""
    __tablename__ = "conversation_permissions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(Uuid(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)  # Clerk User ID
    role = Column(String, nullable=False)  # viewer, editor
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="permissions")


class Notification(Base):
    """Notifications for users (e.g. chat invites)."""
    __tablename__ = "notifications"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)  # Recipient Clerk ID
    type = Column(String, default="invite") # invite, system, etc.
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    link = Column(String, nullable=True) # e.g. /dashboard?chat=uuid
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# Database Setup (Simple for now, should use Alembic in prod)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..config import get_settings

settings = get_settings()

# Ensure we have a DB URL. Fallback to sqlite if not configured, or fail.
# Assuming standard POSTGRES_URL or similar.
DATABASE_URL = getattr(settings, "database_url", "sqlite:///./chat.db") 

# Fix for Postgres URL if it starts with postgres:// (SQLAlchemy wants postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
