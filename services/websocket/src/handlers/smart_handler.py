"""Smart message handler with automatic intent detection.

This handler automatically determines whether to:
- Use general chat (no RAG needed)
- Query the knowledge base (RAG search)
- Combine both (hybrid mode)

Based on the user's message content and context.
"""

import asyncio
import logging
import re
import sys
import time
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from uuid import uuid4
from pathlib import Path
from enum import Enum

from ..models.messages import ChatMessage, ChatResponse
from ..connection_manager import manager

logger = logging.getLogger(__name__)

# Add intellibooks_db module to path for database access
# __file__ = services/websocket/src/handlers/smart_handler.py
# parent.parent.parent.parent = services/
services_path = Path(__file__).parent.parent.parent.parent
intellibooks_db_path = services_path / "intellibooks_db"
if intellibooks_db_path.exists() and str(services_path) not in sys.path:
    sys.path.insert(0, str(services_path))

# Import agents with proper path resolution
# project_root = parent of services = IntelliBooksStudio/
project_root = services_path.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

try:
    from services.agents.src.agents.chat_agent import ChatAgent
    CHAT_AGENT_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ChatAgent not available: {e}")
    ChatAgent = None
    CHAT_AGENT_AVAILABLE = False

try:
    from services.agents.src.agents.research_agent import ResearchAgent
    RESEARCH_AGENT_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ResearchAgent not available: {e}")
    ResearchAgent = None
    RESEARCH_AGENT_AVAILABLE = False

try:
    from services.agents.src.agents.analytics_agent import AnalyticsAgent
    ANALYTICS_AGENT_AVAILABLE = True
except ImportError as e:
    logger.warning(f"AnalyticsAgent not available: {e}")
    AnalyticsAgent = None
    ANALYTICS_AGENT_AVAILABLE = False


class MessageIntent(Enum):
    """Detected intent for a message."""
    GENERAL_CHAT = "general_chat"
    KNOWLEDGE_QUERY = "knowledge_query"
    ANALYTICS_QUERY = "analytics_query"
    HYBRID = "hybrid"


# Keywords and patterns that suggest analytics/database queries
ANALYTICS_QUERY_PATTERNS = [
    # Database-related keywords
    r"\b(show|display|list|get|fetch|query|select|find)\s+(me\s+)?(all|the|data|records|rows|results)\b",
    r"\b(count|sum|total|average|avg|max|min|group by|order by)\b",
    r"\b(table|tables|column|columns|schema|database|db)\b",
    r"\b(top|bottom|first|last)\s+\d+\b",
    r"\b(how many|how much|what is the|what are the)\b.*\b(in|from|of)\b",
    r"\b(revenue|sales|orders|customers|products|users)\b.*\b(by|grouped|per|for)\b",
    r"\b(analyze|analysis|analytics|report|insight|metric|kpi)\b",
    r"\b(join|inner join|left join|right join|union)\b",
    r"\b(where|having|filter|filtered)\b.*\b(and|or)\b",
    r"\b(aggregate|aggregation|group|pivot)\b",
]

# Keywords and patterns that suggest knowledge base queries
KNOWLEDGE_QUERY_PATTERNS = [
    # Question words that typically need knowledge
    r"\b(what|who|when|where|why|how|which|explain|describe|tell me about)\b.*\?",
    r"\b(what is|what are|what was|what were|who is|who are)\b",

    # Action words suggesting research/lookup
    r"\b(find|search|look up|lookup|retrieve|get|fetch)\b",
    r"\b(summarize|summary|overview|recap)\b",

    # Reference to documents/transcripts/meetings
    r"\b(document|file|transcript|meeting|recording|notes|source)\b",
    r"\b(in the|from the|according to|based on)\b.*\b(document|file|transcript|meeting)\b",

    # Comparative/analytical queries
    r"\b(compare|difference|between|versus|vs)\b",
    r"\b(list|enumerate|give me|show me|provide)\b",

    # Time-based queries about content
    r"\b(discussed|mentioned|talked about|said about|covered)\b",
    r"\b(last|previous|recent|earlier)\b.*\b(meeting|transcript|session)\b",
]

# Patterns that suggest general chat (no RAG needed)
GENERAL_CHAT_PATTERNS = [
    # Greetings and pleasantries
    r"^(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b",
    r"^(thanks|thank you|thx|appreciate it)\b",
    r"^(bye|goodbye|see you|later|take care)\b",

    # Simple acknowledgments
    r"^(ok|okay|sure|got it|understood|makes sense|i see|alright)\b",
    r"^(yes|no|maybe|perhaps)\b$",

    # About the assistant itself
    r"\b(who are you|what are you|what can you do|help me|how do you work)\b",

    # Simple math or conversions (no knowledge needed)
    r"^\d+\s*[\+\-\*\/]\s*\d+",

    # Code-related that doesn't need knowledge base
    r"^(write|create|generate)\s+(a |an )?(code|function|script|program)\b",
]


def detect_intent(message: str) -> Tuple[MessageIntent, float]:
    """
    Detect the intent of a message.

    Returns:
        Tuple of (intent, confidence)
    """
    message_lower = message.lower().strip()

    # Check for general chat patterns first
    for pattern in GENERAL_CHAT_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            return MessageIntent.GENERAL_CHAT, 0.9

    # Check for analytics query patterns
    analytics_matches = 0
    for pattern in ANALYTICS_QUERY_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            analytics_matches += 1

    # If multiple analytics patterns match, high confidence it's an analytics query
    if analytics_matches >= 2:
        return MessageIntent.ANALYTICS_QUERY, 0.95
    elif analytics_matches == 1:
        return MessageIntent.ANALYTICS_QUERY, 0.75

    # Check for knowledge query patterns
    knowledge_matches = 0
    for pattern in KNOWLEDGE_QUERY_PATTERNS:
        if re.search(pattern, message_lower, re.IGNORECASE):
            knowledge_matches += 1

    # If multiple knowledge patterns match, high confidence it's a knowledge query
    if knowledge_matches >= 2:
        return MessageIntent.KNOWLEDGE_QUERY, 0.95
    elif knowledge_matches == 1:
        return MessageIntent.KNOWLEDGE_QUERY, 0.75

    # Check message length and question marks
    is_question = message.strip().endswith("?")
    is_long = len(message) > 50

    # Long questions are likely knowledge queries
    if is_question and is_long:
        return MessageIntent.KNOWLEDGE_QUERY, 0.7

    # Short questions might be either
    if is_question:
        return MessageIntent.HYBRID, 0.5

    # Default to general chat for short messages
    if len(message) < 30:
        return MessageIntent.GENERAL_CHAT, 0.6

    # For medium-length non-questions, use hybrid approach
    return MessageIntent.HYBRID, 0.5


def get_intent_description(intent: MessageIntent) -> str:
    """Get a human-readable description of what the system is doing."""
    descriptions = {
        MessageIntent.GENERAL_CHAT: "Thinking...",
        MessageIntent.KNOWLEDGE_QUERY: "Searching knowledge base...",
        MessageIntent.ANALYTICS_QUERY: "Querying database...",
        MessageIntent.HYBRID: "Analyzing query and searching knowledge...",
    }
    return descriptions.get(intent, "Processing...")


async def send_status_update(
    websocket,
    session_id: str,
    status: str,
    intent: MessageIntent,
):
    """Send a status update to the client about what's happening."""
    try:
        status_message = {
            "type": "status",
            "session_id": session_id,
            "status": status,
            "intent": intent.value,
            "description": get_intent_description(intent),
            "timestamp": datetime.utcnow().isoformat(),
        }
        await manager.send_personal_message(status_message, websocket)
    except Exception as e:
        logger.warning(f"Failed to send status update: {e}")


async def process_with_chat_agent(message: ChatMessage) -> ChatResponse:
    """Process message with chat agent (no RAG)."""
    if not CHAT_AGENT_AVAILABLE or ChatAgent is None:
        return ChatResponse(
            type="message",
            content="I'm here to help! However, the chat service is currently initializing. Please try again in a moment.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"intent": "general_chat", "rag_used": False},
        )

    chat_agent = ChatAgent()
    agent_result = await chat_agent.safe_execute({
        "message": message.content,
        "text": message.content,
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
                "intent": "general_chat",
                "rag_used": False,
                "agent_id": agent_result.metadata.get("agent_id", "chat-agent") if agent_result.metadata else "chat-agent",
            },
        )
    else:
        return ChatResponse(
            type="message",
            content="I encountered an issue processing your message. Please try again.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"intent": "general_chat", "rag_used": False, "error": True},
        )


async def process_with_analytics_agent(message: ChatMessage, db_config: Optional[Dict[str, Any]] = None) -> ChatResponse:
    """Process message with analytics agent (database queries)."""
    if not ANALYTICS_AGENT_AVAILABLE or AnalyticsAgent is None:
        return ChatResponse(
            type="message",
            content="I'd like to query the database for you, but the analytics service is currently initializing. Please try again in a moment.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"intent": "analytics_query", "error": "agent_not_available"},
        )

    try:
        # Create analytics agent with optional database config
        analytics_agent = AnalyticsAgent(
            db_config=db_config,
            session_id=message.session_id,
            enable_memory=True,
        )
        
        agent_result = await analytics_agent.safe_execute({
            "query": message.content,
            "question": message.content,
            "message": message.content,
            "text": message.content,
        })

        if agent_result.success and agent_result.data:
            response_data = agent_result.data
            response_content = response_data.get("response", response_data.get("answer", "I couldn't generate a query."))
            sql_query = response_data.get("sql")
            query_results = response_data.get("results")

            return ChatResponse(
                type="message",
                content=response_content,
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={
                    "intent": "analytics_query",
                    "sql": sql_query,
                    "results": query_results,
                    "row_count": query_results.get("row_count", 0) if query_results else 0,
                    "agent_id": agent_result.metadata.get("agent_id", "analytics-agent") if agent_result.metadata else "analytics-agent",
                },
            )
        else:
            error_msg = agent_result.error or "Failed to process analytics query"
            return ChatResponse(
                type="error",
                content=f"I encountered an issue querying the database: {error_msg}. Please ensure the database is configured.",
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={"intent": "analytics_query", "error": True},
            )
    except Exception as e:
        logger.exception(f"Error processing analytics query: {e}")
        return ChatResponse(
            type="error",
            content=f"I encountered an error processing your analytics query: {str(e)}. Please check your database configuration.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"intent": "analytics_query", "error": True},
        )


async def process_with_research_agent(message: ChatMessage) -> ChatResponse:
    """Process message with research agent (RAG enabled)."""
    if not RESEARCH_AGENT_AVAILABLE or ResearchAgent is None:
        return ChatResponse(
            type="message",
            content="I'd like to search the knowledge base for you, but the research service is currently initializing. Please try again in a moment.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"intent": "knowledge_query", "rag_used": False},
        )

    research_agent = ResearchAgent()
    agent_result = await research_agent.safe_execute({
        "query": message.content,
        "question": message.content,
        "message": message.content,
        "text": message.content,
    })

    if agent_result.success and agent_result.data:
        response_data = agent_result.data
        response_content = response_data.get("response", response_data.get("answer", "I couldn't find relevant information."))
        sources = response_data.get("sources", [])
        confidence = response_data.get("confidence", 0.0)

        return ChatResponse(
            type="message",
            content=response_content,
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={
                "intent": "knowledge_query",
                "rag_used": True,
                "sources": sources,
                "sources_count": len(sources),
                "confidence": confidence,
                "agent_id": agent_result.metadata.get("agent_id", "research-agent") if agent_result.metadata else "research-agent",
            },
        )
    else:
        # Fallback to chat agent if research fails
        logger.warning("Research agent failed, falling back to chat agent")
        return await process_with_chat_agent(message)


async def process_smart_message(
    message: ChatMessage,
    websocket=None,
) -> ChatResponse:
    """
    Process a message using smart intent detection.

    Automatically determines whether to use:
    - General chat (no RAG)
    - Knowledge base search (RAG)
    - Hybrid approach
    """
    logger.info(f"Processing smart message for session {message.session_id}")

    # Detect intent
    intent, confidence = detect_intent(message.content)
    logger.info(f"Detected intent: {intent.value} (confidence: {confidence:.2f})")

    # Send status update to client if websocket provided
    if websocket:
        await send_status_update(websocket, message.session_id, "processing", intent)

    try:
        if intent == MessageIntent.GENERAL_CHAT:
            response = await process_with_chat_agent(message)
        elif intent == MessageIntent.ANALYTICS_QUERY:
            # Get database config from Redis storage
            db_config = None
            try:
                from ..utils.redis_client import get_db_config
                db_config = await get_db_config(message.session_id)
                if not db_config:
                    logger.warning(f"No database configuration found for session {message.session_id}")
            except Exception as e:
                logger.warning(f"Failed to retrieve database config: {e}")
            
            response = await process_with_analytics_agent(message, db_config)
        elif intent == MessageIntent.KNOWLEDGE_QUERY:
            response = await process_with_research_agent(message)
        else:  # HYBRID
            # Try research first, if no good results fall back to chat
            response = await process_with_research_agent(message)

            # If no sources found or low confidence, enhance with chat
            sources = response.metadata.get("sources", []) if response.metadata else []
            rag_confidence = response.metadata.get("confidence", 0) if response.metadata else 0

            if len(sources) == 0 or rag_confidence < 0.3:
                logger.info("Low RAG confidence, using chat agent for hybrid response")
                chat_response = await process_with_chat_agent(message)
                # Combine responses if both have content
                if chat_response.content and response.content:
                    response.metadata["hybrid"] = True

        # Add intent info to response
        if response.metadata is None:
            response.metadata = {}
        response.metadata["detected_intent"] = intent.value
        response.metadata["intent_confidence"] = confidence

        return response

    except Exception as e:
        logger.exception(f"Error processing smart message: {e}")
        return ChatResponse(
            type="error",
            content=f"I encountered an error: {str(e)}. Please try again.",
            role="assistant",
            session_id=message.session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            metadata={"error": True, "intent": intent.value},
        )


async def persist_message(
    session_id: str,
    message_id: str,
    role: str,
    content: str,
    sources: list = None,
    intent: str = None,
    intent_confidence: float = None,
    rag_used: bool = False,
    processing_time_ms: float = None,
    metadata: dict = None,
) -> bool:
    """Persist a message to the database if available."""
    try:
        from intellibooks_db.database import get_db_pool, MessageRepository, SessionRepository

        pool = await get_db_pool()
        if not pool:
            return False

        # Ensure session exists
        session_repo = SessionRepository(pool)
        await session_repo.get_or_create(session_id)

        # Save message
        message_repo = MessageRepository(pool)
        result = await message_repo.create(
            message_id=message_id,
            session_id=session_id,
            role=role,
            content=content,
            sources=sources,
            intent=intent,
            intent_confidence=intent_confidence,
            rag_used=rag_used,
            processing_time_ms=processing_time_ms,
            metadata=metadata,
        )
        return result is not None
    except ImportError:
        logger.debug("Database module not available for message persistence")
        return False
    except Exception as e:
        logger.error(f"Failed to persist message: {e}")
        return False


async def handle_smart_message(
    websocket,
    message_data: dict,
    session_id: str,
) -> Optional[ChatResponse]:
    """Handle an incoming message with smart routing."""
    start_time = time.time()

    try:
        # Validate message
        message_data["session_id"] = session_id
        if "type" not in message_data:
            message_data["type"] = "message"

        chat_message = ChatMessage(**message_data)

        # Persist user message
        user_message_id = f"user-{int(time.time() * 1000)}-{uuid4().hex[:8]}"
        await persist_message(
            session_id=session_id,
            message_id=user_message_id,
            role="user",
            content=chat_message.content,
        )

        # Process with smart handler
        response = await process_smart_message(chat_message, websocket)

        # Calculate processing time
        processing_time_ms = (time.time() - start_time) * 1000

        # Persist assistant response
        if response:
            sources = response.metadata.get("sources", []) if response.metadata else []
            intent = response.metadata.get("detected_intent") if response.metadata else None
            intent_confidence = response.metadata.get("intent_confidence") if response.metadata else None
            rag_used = response.metadata.get("rag_used", False) if response.metadata else False

            await persist_message(
                session_id=session_id,
                message_id=response.message_id,
                role="assistant",
                content=response.content,
                sources=sources,
                intent=intent,
                intent_confidence=intent_confidence,
                rag_used=rag_used,
                processing_time_ms=processing_time_ms,
                metadata=response.metadata,
            )

        return response

    except Exception as e:
        logger.error(f"Error handling smart message: {e}")
        return ChatResponse(
            type="error",
            content=f"Error processing message: {str(e)}",
            role="assistant",
            session_id=session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
        )
