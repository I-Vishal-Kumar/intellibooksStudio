"""Chat message handler."""

import asyncio
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from ..models.messages import ChatMessage, ChatResponse
from ..connection_manager import manager

logger = logging.getLogger(__name__)


async def process_chat_message(message: ChatMessage) -> ChatResponse:
    """
    Process a chat message and return a response.
    
    TODO: In the future, this will:
    1. Publish message to Redis pub/sub
    2. Agent service will process and respond
    3. Response will be published back via Redis
    4. This handler will receive and return the response
    
    For now, returns a demo response.
    """
    logger.info(f"Processing chat message for session {message.session_id}")
    
    # Simulate processing delay (like calling agent service)
    await asyncio.sleep(0.5)
    
    # TODO: Replace with actual Redis pub/sub call
    # For now, generate a demo response
    demo_responses = [
        f"I understand you said: '{message.content[:50]}...'. This is a demo response. The actual agent service integration will be implemented via Redis pub/sub.",
        "That's an interesting question! Once we integrate with the agent service through Redis pub/sub, I'll be able to provide more detailed responses.",
        "I'm currently running in demo mode. Real-time agent responses will be available once the Redis pub/sub integration is complete.",
    ]
    
    # Simple logic to vary responses
    response_index = hash(message.content) % len(demo_responses)
    response_content = demo_responses[response_index]
    
    # If message contains keywords, provide more specific demo responses
    content_lower = message.content.lower()
    if "audio" in content_lower or "transcribe" in content_lower:
        response_content = "I can help you with audio transcription! Upload an audio file and I'll process it using our transcription agents. (Demo mode - Redis pub/sub integration pending)"
    elif "translate" in content_lower:
        response_content = "Translation services are available! I can translate your audio transcripts to 30+ languages. (Demo mode - Redis pub/sub integration pending)"
    elif "summarize" in content_lower or "summary" in content_lower:
        response_content = "I can create summaries of your audio content with key points and action items. (Demo mode - Redis pub/sub integration pending)"
    
    return ChatResponse(
        type="message",
        content=response_content,
        role="assistant",
        session_id=message.session_id,
        message_id=str(uuid4()),
        timestamp=datetime.utcnow(),
        metadata={
            "demo": True,
            "original_message_length": len(message.content),
        },
    )


async def handle_chat_message(
    websocket,
    message_data: dict,
    session_id: str,
) -> Optional[ChatResponse]:
    """Handle an incoming chat message."""
    try:
        # Validate message
        chat_message = ChatMessage(**message_data)
        chat_message.session_id = session_id  # Ensure session_id matches
        
        # Process message (will call Redis pub/sub in future)
        response = await process_chat_message(chat_message)
        
        return response
        
    except Exception as e:
        logger.error(f"Error handling chat message: {e}")
        return ChatResponse(
            type="error",
            content=f"Error processing message: {str(e)}",
            role="assistant",
            session_id=session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
        )

