"""Research message handler."""

import asyncio
import logging
import sys
from datetime import datetime
from typing import Optional
from uuid import uuid4
from pathlib import Path

from ..models.messages import ChatMessage, ChatResponse
from ..connection_manager import manager

logger = logging.getLogger(__name__)

# Import ResearchAgent with proper path resolution
# Try installed package first, then fallback to direct import with sys.path manipulation
try:
    # First try: If services are installed as editable packages
    from services.agents.src.agents.research_agent import ResearchAgent
    logger.debug("Imported ResearchAgent from installed package")
except ImportError:
    try:
        # Second try: Direct import (if running from workspace root)
        from agents.src.agents.research_agent import ResearchAgent
        logger.debug("Imported ResearchAgent via direct import")
    except ImportError:
        # Third try: Add project root to path and import
        project_root = Path(__file__).parent.parent.parent.parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        try:
            from services.agents.src.agents.research_agent import ResearchAgent
            logger.info(f"Imported ResearchAgent by adding project root to path: {project_root}")
        except ImportError as e:
            logger.error(f"Failed to import ResearchAgent: {e}")
            logger.warning("ResearchAgent not available. Using demo responses.")
            ResearchAgent = None


async def process_research_message(message: ChatMessage, research_params: Optional[dict] = None) -> ChatResponse:
    """
    Process a research message and return a response.
    
    Args:
        message: ChatMessage containing the research query
        research_params: Optional dict with research parameters (top_k, filters, use_rag)
    
    Returns:
        ChatResponse with research results and sources
    """
    logger.info(f"Processing research message for session {message.session_id}")
    
    try:
        if ResearchAgent is None:
            return _get_demo_response(message)
        
        research_agent = ResearchAgent()
        
        # Build input data for research agent
        input_data = {
            "query": message.content,
            "question": message.content,  # Support both keys
            "message": message.content,
            "text": message.content,
        }
        
        # Add research parameters if provided
        if research_params:
            if "top_k" in research_params:
                input_data["top_k"] = research_params["top_k"]
            if "filters" in research_params:
                input_data["filters"] = research_params["filters"]
            if "use_rag" in research_params:
                input_data["use_rag"] = research_params["use_rag"]
        
        # Process message with research agent
        agent_result = await research_agent.safe_execute(input_data)
        
        if agent_result.success and agent_result.data:
            response_data = agent_result.data
            response_content = response_data.get("response", response_data.get("answer", "I apologize, I couldn't generate a response."))
            sources = response_data.get("sources", [])
            confidence = response_data.get("confidence", 0.0)
            result_metadata = agent_result.metadata or {}

            # Build metadata with sources and confidence
            metadata = {
                "agent_id": result_metadata.get("agent_id", "research-agent"),
                "input_length": result_metadata.get("input_length", 0),
                "response_length": result_metadata.get("response_length", 0),
                "sources_count": len(sources),
                "confidence": confidence,
                "rag_used": result_metadata.get("rag_used", False),
            }
            
            # Include sources in metadata if available
            if sources:
                metadata["sources"] = sources

            return ChatResponse(
                type="message",
                content=response_content,
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata=metadata,
            )
        else:
            # Agent execution failed, return error response
            error_msg = agent_result.error or "Failed to process research query"
            logger.error(f"Research agent error: {error_msg}")
            
            return ChatResponse(
                type="error",
                content=f"I encountered an error while researching: {error_msg}. Please try again.",
                role="assistant",
                session_id=message.session_id,
                message_id=str(uuid4()),
                timestamp=datetime.utcnow(),
                metadata={"error": True},
            )
            
    except Exception as e:
        logger.exception(f"Error processing research message: {e}")
        # Fallback to demo response on error
        return _get_demo_response(message)


def _get_demo_response(message: ChatMessage) -> ChatResponse:
    """Fallback demo response if agent is not available."""
    demo_responses = [
        f"I understand you're asking: '{message.content[:50]}...'. This is a demo response. The research agent service integration will provide comprehensive answers using RAG and knowledge sources.",
        "That's an interesting research question! Once the research agent service is fully integrated, I'll be able to provide detailed, source-cited answers using our knowledge base.",
        "I'm currently running in demo mode. Research capabilities with RAG and knowledge graph integration will be available once the service integration is complete.",
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


async def handle_research_message(
    websocket,
    message_data: dict,
    session_id: str,
) -> Optional[ChatResponse]:
    """Handle an incoming research message."""
    try:
        # Ensure type is set to research
        message_data["type"] = "research"
        message_data["session_id"] = session_id
        
        # Validate message
        chat_message = ChatMessage(**message_data)
        
        # Extract research parameters from message_data if present
        research_params = message_data.get("research_params")
        
        # Process message
        response = await process_research_message(chat_message, research_params)
        
        return response
        
    except Exception as e:
        logger.error(f"Error handling research message: {e}")
        return ChatResponse(
            type="error",
            content=f"Error processing research query: {str(e)}",
            role="assistant",
            session_id=session_id,
            message_id=str(uuid4()),
            timestamp=datetime.utcnow(),
        )

