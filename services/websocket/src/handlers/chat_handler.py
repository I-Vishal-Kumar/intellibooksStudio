"""Chat message handler."""

import asyncio
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4
from pathlib import Path

from ..models.messages import ChatMessage, ChatResponse
from ..connection_manager import manager

logger = logging.getLogger(__name__)

# TODO: Replace direct import with Redis pub/sub integration
# For now, importing directly for testing
import sys
from pathlib import Path

# Add agents service directory to path so we can import from src.agents
# chat_handler.py is at: services/websocket/src/handlers/chat_handler.py
# We need: services/agents (parent of src)
# So: go up 4 levels (handlers -> src -> websocket -> services) then into agents
agents_service_path = Path(__file__).parent.parent.parent.parent / "agents"
if agents_service_path.exists():
    sys.path.insert(0, str(agents_service_path))
    logger.info(f"Added agents service path: {agents_service_path}")
else:
    logger.warning(f"Agents service path not found: {agents_service_path}")

try:
    # Import from src.agents since we added the agents service directory to path
    from services.agents.src.agents import ChatAgent
    _chat_agent = None
    
    def get_chat_agent():
        """Get or create chat agent instance."""
        global _chat_agent
        if _chat_agent is None:
            _chat_agent = ChatAgent()
        return _chat_agent
except ImportError as e:
    logger.warning(f"ChatAgent not available: {e}. Using demo responses.")
    get_chat_agent = None


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
        if get_chat_agent is None:
            # Fallback to demo response if agent not available
            return _get_demo_response(message)
        
        # Get chat agent instance
        chat_agent = get_chat_agent()
        
        # Initialize agent if needed
        if not chat_agent._is_initialized:
            await chat_agent.initialize()
        
        # Process message with chat agent
        agent_result = await chat_agent.safe_execute({
            "message": message.content,
            "text": message.content,  # Support both keys
        })
        
        if agent_result.success and agent_result.data:
            response_content = agent_result.data.get("response", "I apologize, I couldn't generate a response.")
            
            return ChatResponse(
                type="message",
                content=response_content,
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={
                    "agent_id": agent_result.agent_id,
                    "input_length": agent_result.metadata.get("input_length", 0),
                    "response_length": agent_result.metadata.get("response_length", 0),
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

