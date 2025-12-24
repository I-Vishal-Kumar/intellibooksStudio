"""Chat message handler."""

import asyncio
import logging
import sys
from datetime import datetime
from typing import Optional
from uuid import uuid4
from pathlib import Path

from ..models.messages import ChatMessage, ChatResponse
from ..connection_manager import manager
from ..models.db import SessionLocal, Conversation, Message

logger = logging.getLogger(__name__)

# Import ChatAgent with proper path resolution
# Try installed package first, then fallback to direct import with sys.path manipulation
try:
    # First try: If services are installed as editable packages
    from services.agents.src.agents.chat_agent import ChatAgent
    logger.debug("Imported ChatAgent from installed package")
except ImportError:
    try:
        # Second try: Direct import (if running from workspace root)
        from agents.src.agents.chat_agent import ChatAgent
        logger.debug("Imported ChatAgent via direct import")
    except ImportError:
        # Third try: Add project root to path and import
        project_root = Path(__file__).parent.parent.parent.parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        try:
            from services.agents.src.agents.chat_agent import ChatAgent
            logger.info(f"Imported ChatAgent by adding project root to path: {project_root}")
        except ImportError as e:
            logger.error(f"Failed to import ChatAgent: {e}")
            logger.warning("ChatAgent not available. Using demo responses.")
            ChatAgent = None



async def process_chat_message(message: ChatMessage) -> ChatResponse:
    """
    Process a chat message and return a response.
    
    TODO: In the future, this will:
    1. Publish message to Redis pub/sub channel
    2. Agent service will subscribe, process with ChatAgent, and respond
    3. Response will be published back via Redis
    4. This handler will receive and return the response
    
    For now, directly calls the ChatAgent for testing.
    """
    logger.info(f"Processing chat message for session {message.session_id}")
    
    try:
        # TODO: Replace with Redis pub/sub integration
        # For now, directly import and call ChatAgent for testing
        if ChatAgent is None:
            return _get_demo_response(message)
        
        chat_agent = ChatAgent()
        
        # Process message with chat agent
        agent_result = await chat_agent.safe_execute({
            "message": message.content,
            "text": message.content,  # Support both keys
        })
        
        if agent_result.success and agent_result.data:
            response_content = agent_result.data.get("response", "I apologize, I couldn't generate a response.")
            result_metadata = agent_result.metadata or {}

            return ChatResponse(
                type="message",
                content=response_content,
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={
                    "agent_id": result_metadata.get("agent_id", "simple-chat-agent"),
                    "input_length": result_metadata.get("input_length", 0),
                    "response_length": result_metadata.get("response_length", 0),
                },
            )
        else:
            # Agent execution failed, return error response
            error_msg = agent_result.error or "Failed to process message"
            logger.error(f"Chat agent error: {error_msg}")
            
            return ChatResponse(
                type="error",
                content=f"I encountered an error: {error_msg}. Please try again.",
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={"error": True},
            )
            
    except Exception as e:
        logger.exception(f"Error processing chat message: {e}")
        # Fallback to demo response on error
        return _get_demo_response(message)


def _get_demo_response(message: ChatMessage) -> ChatResponse:
    """Fallback demo response if agent is not available."""
    demo_responses = [
        f"I understand you said: '{message.content[:50]}...'. This is a demo response. The actual agent service integration will be implemented via Redis pub/sub.",
        "That's an interesting question! Once we integrate with the agent service through Redis pub/sub, I'll be able to provide more detailed responses.",
        "I'm currently running in demo mode. Real-time agent responses will be available once the Redis pub/sub integration is complete.",
    ]
    
    response_index = hash(message.content) % len(demo_responses)
    response_content = demo_responses[response_index]
    
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
        
        # Save User Message to DB
        db = SessionLocal()
        conversation = db.query(Conversation).filter(Conversation.id == session_id).first()
        
        # Auto-create conversation if new (for now, usually created via API)
        if not conversation:
            # Try to get user_id from metadata or use default
            user_id = chat_message.user_id or "unknown_user"
            conversation = Conversation(id=session_id, user_id=user_id, title="New Chat")
            db.add(conversation)
            db.commit()
            
        user_msg_db = Message(
            conversation_id=session_id,
            role="user",
            content=chat_message.content
        )
        db.add(user_msg_db)
        db.commit()
        
        # Process message
        response = await process_chat_message(chat_message)
        
        # Save Assistant Response to DB
        if response and response.type == "message":
            assistant_msg_db = Message(
                conversation_id=session_id,
                role="assistant",
                content=response.content,
                metadata_=response.metadata or {}
            )
            db.add(assistant_msg_db)
            db.commit()
            
        db.close()
        
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

