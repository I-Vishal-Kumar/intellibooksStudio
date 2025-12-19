"""WebSocket message models."""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class ChatMessage(BaseModel):
    """Incoming chat message from client."""

    type: Literal["message"] = "message"
    content: str = Field(..., min_length=1, max_length=10000)
    session_id: str
    user_id: Optional[str] = None
    metadata: Optional[dict] = None


class ChatResponse(BaseModel):
    """Outgoing chat message to client."""

    type: Literal["message", "error", "system"] = "message"
    content: str
    role: Literal["user", "assistant", "system"] = "assistant"
    session_id: str
    message_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict] = None


class SystemMessage(BaseModel):
    """System notification message."""

    type: Literal["system"] = "system"
    event: str  # e.g., "user_joined", "user_left", "error"
    content: str
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorMessage(BaseModel):
    """Error message to client."""

    type: Literal["error"] = "error"
    error: str
    code: Optional[str] = None
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

