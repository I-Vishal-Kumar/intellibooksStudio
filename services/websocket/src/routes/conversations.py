"""Routes for conversation management and public sharing."""

import uuid
import secrets
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, UUID4, Field

from ..models.db import get_db, Conversation, Message, init_db
from ..utils.permissions import get_user_role
from ..utils.clerk import get_user_id_by_email

router = APIRouter(prefix="/api/conversations", tags=["conversations"])
print("DEBUG: Conversations router initialized")

# DTOs
class PublishResponse(BaseModel):
    share_token: str
    share_url: str

class MessageResponse(BaseModel):
    id: UUID4
    role: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class CollaboratorRequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: str = Field(..., pattern="^(viewer|editor)$")

class CollaboratorResponse(BaseModel):
    id: UUID4
    user_id: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: UUID4
    title: Optional[str]
    is_public: bool
    document_ids: List[str] = []
    messages: List[MessageResponse]
    
    class Config:
        from_attributes = True


@router.on_event("startup")
async def startup_event():
    """Initialize DB on startup (for dev simplicity)."""
    # In production, use migrations!
    try:
        init_db()
    except Exception as e:
        print(f"DB Interface Error: {e}")


@router.post("/{conversation_id}/publish", response_model=PublishResponse)
async def publish_conversation(
    conversation_id: UUID4, 
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Make a conversation public."""
    # Check permission
    role = await get_user_role(db, conversation_id, x_user_id)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can publish")

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Generate token if not exists
    if not conversation.share_token:
        # Generate URL-safe token
        conversation.share_token = secrets.token_urlsafe(16)
        
    conversation.is_public = True
    db.commit()
    db.refresh(conversation)
    
    return PublishResponse(
        share_token=conversation.share_token,
        share_url=f"/share/{conversation.share_token}" # Frontend URL path
    )


@router.get("/public/{share_token}", response_model=ConversationResponse)
async def get_public_conversation(share_token: str, db: Session = Depends(get_db)):
    """Get a public conversation by token."""
    conversation = db.query(Conversation).filter(
        Conversation.share_token == share_token,
        Conversation.is_public == True
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found or not public")
        
    # Serialize manually or via Pydantic
    return conversation


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID4, 
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Get a conversation by ID (private/collaborative)."""
    # Check permission
    role = await get_user_role(db, conversation_id, x_user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return conversation


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def add_message(
    conversation_id: UUID4,
    role: str = Body(..., embed=True),
    content: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Add a message to a conversation."""
    # Check permission
    user_role = await get_user_role(db, conversation_id, x_user_id)
    if user_role not in ["owner", "editor"]:
        raise HTTPException(status_code=403, detail="Write access required")

    new_msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg


@router.post("/{conversation_id}/collaborators", response_model=CollaboratorResponse)
async def add_collaborator(
    conversation_id: UUID4,
    collaborator: CollaboratorRequest,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Add or update a collaborator for a conversation."""
    # Check permission
    role = await get_user_role(db, conversation_id, x_user_id)
    print(f"DEBUG: add_collaborator - role={role}, target={collaborator.user_id}, email={collaborator.email}")
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage collaborators")

    # Resolve email to user_id if needed
    target_user_id = collaborator.user_id
    if not target_user_id and collaborator.email:
        resolved_id = await get_user_id_by_email(collaborator.email)
        if not resolved_id:
            raise HTTPException(status_code=404, detail=f"User not found with email: {collaborator.email}")
        target_user_id = resolved_id
    
    if not target_user_id:
        raise HTTPException(status_code=400, detail="Either user_id or email must be provided")

    from ..models.db import ConversationPermission
    
    # Check if exists
    existing = db.query(ConversationPermission).filter(
        ConversationPermission.conversation_id == conversation_id,
        ConversationPermission.user_id == target_user_id
    ).first()
    
    if existing:
        existing.role = collaborator.role
        db.commit()
        db.refresh(existing)
        # Create notification even for role updates
        create_invite_notification(db, target_user_id, conversation_id, collaborator.role)
        return existing
        
    new_perm = ConversationPermission(
        conversation_id=conversation_id,
        user_id=target_user_id,
        role=collaborator.role
    )
    db.add(new_perm)
    db.commit()
    db.refresh(new_perm)
    
    # Create notification
    create_invite_notification(db, target_user_id, conversation_id, collaborator.role)
    
    return new_perm

def create_invite_notification(db: Session, user_id: str, conversation_id: UUID4, role: str):
    """Helper to create an invite notification."""
    print(f"DEBUG: Creating invite notification for user_id={user_id}, conv={conversation_id}")
    from ..models.db import Notification, Conversation
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    title = f"New Chat Invite: {conv.title if conv and conv.title else 'Untitled'}"
    content = f"You have been invited to collaborate as an {role}."
    link = f"/dashboard/v2?chatId={conversation_id}"
    
    notif = Notification(
        user_id=user_id,
        title=title,
        content=content,
        link=link,
        type="invite"
    )
    db.add(notif)
    db.commit()


@router.get("/{conversation_id}/collaborators", response_model=List[CollaboratorResponse])
async def list_collaborators(
    conversation_id: UUID4,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """List all collaborators for a conversation."""
    # Check permission
    role = await get_user_role(db, conversation_id, x_user_id)
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    from ..models.db import ConversationPermission
    return db.query(ConversationPermission).filter(
        ConversationPermission.conversation_id == conversation_id
    ).all()


@router.delete("/{conversation_id}/collaborators/{user_id}")
async def remove_collaborator(
    conversation_id: UUID4,
    user_id: str,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Remove a collaborator from a conversation."""
    # Check permission
    role = await get_user_role(db, conversation_id, x_user_id)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owners can manage collaborators")

    from ..models.db import ConversationPermission
    perm = db.query(ConversationPermission).filter(
        ConversationPermission.conversation_id == conversation_id,
        ConversationPermission.user_id == user_id
    ).first()
    
    if not perm:
        raise HTTPException(status_code=404, detail="Collaborator not found")
        
    db.delete(perm)
    db.commit()
    return {"status": "success"}


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    title: str = Body(default="New Chat"), 
    user_id: str = Body(..., embed=True), # In real app, get from Auth header
    document_ids: List[str] = Body(default=[]),
    db: Session = Depends(get_db)
):
    """Create a new conversation."""
    new_chat = Conversation(
        user_id=user_id,
        title=title,
        document_ids=document_ids
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat
