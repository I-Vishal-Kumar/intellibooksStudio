"""Chat Agent - Intelligent conversational agent for user support."""

from typing import Optional, Any
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src"))

from identity import Skill, TrustLevel, ActionType
from base import BaseAgent, AgentResult, AgentContext

from ..llm_factory import create_llm_settings

logger = logging.getLogger(__name__)


class ChatAgent(BaseAgent):
    """Agent for intelligent conversational support and assistance."""

    def __init__(self):
        skills = [
            Skill(
                name="conversation",
                confidence_score=0.90,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Intelligent conversational support and assistance",
            ),
            Skill(
                name="audio_insight_support",
                confidence_score=0.85,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Support for audio transcription, translation, summarization, and analysis",
            ),
        ]

        super().__init__(
            name="chat-agent",
            agent_type="chat",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            llm_settings=create_llm_settings(),
            default_temperature=0.7,  # Conversational agents benefit from moderate creativity
        )

        # System prompt for the chat agent
        self.system_prompt = """You are an intelligent AI assistant for the Audio Insight Platform. 
Your role is to provide helpful support and assistance to users.

Guidelines:
- Be concise and clear in your responses (keep responses short, typically 1-3 sentences)
- Focus on being helpful and informative
- You can help users with:
  * Audio transcription and processing
  * Translation services
  * Summarization and analysis
  * Intent detection and keyword extraction
  * General questions about the platform
- If you don't know something, admit it and suggest alternatives
- Maintain a friendly and professional tone
- Avoid overly long explanations unless specifically requested"""

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Process a chat message and generate a response.

        Args:
            input_data: Dict with 'message' or 'text' containing the user's message
            context: Optional execution context

        Returns:
            AgentResult with chat response
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            # Extract message from input
            message = input_data.get("message") or input_data.get("text", "")
            
            if not message:
                result.error = "No message provided"
                result.mark_complete()
                return result

            # Create prompt with system message
            prompt = ChatPromptTemplate.from_messages([
                ("system", self.system_prompt),
                ("human", "{message}"),
            ])

            # Use base LLM (no structured output needed for chat)
            chain = prompt | self.llm | StrOutputParser()
            response = await chain.ainvoke({"message": message})

            result.success = True
            result.data = {
                "response": response.strip(),
                "message": message,
            }
            result.metadata = {
                "input_length": len(message),
                "response_length": len(response),
            }

        except Exception as e:
            self.logger.exception("Chat agent execution failed")
            result.error = str(e)

        result.mark_complete()
        return result

