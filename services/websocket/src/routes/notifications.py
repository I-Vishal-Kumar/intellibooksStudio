from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, UUID4

from ..models.db import get_db, Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: UUID4
    user_id: str
    type: str
    title: str
    content: str
    link: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    db: Session = Depends(get_db),
    x_user_id: str = Header(...)
):
    """List all notifications for the current user."""
    print(f"DEBUG: list_notifications for user_id={x_user_id}")
    return db.query(Notification).filter(
        Notification.user_id == x_user_id
    ).order_by(Notification.created_at.desc()).all()

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID4,
    db: Session = Depends(get_db),
    x_user_id: str = Header(...)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == x_user_id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    return {"status": "success"}
