from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from ..models.db import Conversation, ConversationPermission

async def get_user_role(
    db: Session, 
    conversation_id: UUID, 
    user_id: Optional[str], 
    is_public_request: bool = False
) -> Optional[str]:
    """
    Returns the role of a user for a given conversation.
    Roles: 'owner', 'editor', 'viewer', or None (no access)
    """
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        return None

    # 1. Owner has full access
    if user_id and conversation.user_id == user_id:
        return "owner"

    # 2. Check explicit permissions
    if user_id:
        perm = db.query(ConversationPermission).filter(
            ConversationPermission.conversation_id == conversation_id,
            ConversationPermission.user_id == user_id
        ).first()
        if perm:
            return perm.role

    # 3. Public access (read-only)
    if conversation.is_public or is_public_request:
        return "viewer"

    return None
