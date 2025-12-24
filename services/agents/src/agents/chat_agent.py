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
from ..middleware import GuardrailsMiddleware

logger = logging.getLogger(__name__)

# Initialize guardrails middleware for ChatAgent
_guardrails_middleware = None

def get_guardrails_middleware():
    """Get or create guardrails middleware instance."""
    global _guardrails_middleware
    if _guardrails_middleware is None:
        _guardrails_middleware = GuardrailsMiddleware(
            detect_pii=True,
            pii_types=["email", "credit_card", "ip", "api_key", "phone", "ssn"],
            pii_strategy="redact",
            detect_prompt_injection=True,
            detect_toxic_content=True,
            banned_keywords=["hack", "exploit", "malware", "virus"],
            use_model_safety_check=False,
            block_on_violation=True,
            log_violations=True,
        )
    return _guardrails_middleware


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

            # Apply guardrails to input (before_model hook)
            guardrails = get_guardrails_middleware()
            input_state = {
                "messages": [{"role": "user", "content": message}]
            }
            
            # Import GuardrailsBlockedException to catch it
            from ..middleware.guardrails_middleware import GuardrailsBlockedException
            
            try:
                guardrails_result = guardrails.before_model(input_state)
            except GuardrailsBlockedException as e:
                # Guardrails blocked the request - return blocking message
                self.logger.warning(f"🚫 Request blocked by guardrails: {e.reason}")
                result.success = True
                result.data = {
                    "response": e.message,
                    "message": message,
                    "blocked": True,
                }
                result.metadata = {
                    "input_length": len(message),
                    "response_length": len(e.message),
                    "blocked_by_guardrails": True,
                    "block_reason": e.reason,
                }
                result.mark_complete()
                return result
            
            # Get potentially modified message (PII redacted, etc.)
            if guardrails_result and guardrails_result.get("messages"):
                modified_messages = guardrails_result["messages"]
                if modified_messages:
                    modified_msg = modified_messages[0]
                    if isinstance(modified_msg, dict):
                        message = modified_msg.get("content", message)
                    elif hasattr(modified_msg, "content"):
                        message = getattr(modified_msg, "content", message)

            # Create prompt with system message
            prompt = ChatPromptTemplate.from_messages([
                ("system", self.system_prompt),
                ("human", "{message}"),
            ])

            # Use base LLM (no structured output needed for chat)
            chain = prompt | self.llm | StrOutputParser()
            response = await chain.ainvoke({"message": message})
            response = response.strip()

            # Apply guardrails to output (after_model hook)
            output_state = {
                "messages": [
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": response}
                ]
            }
            guardrails_output_result = guardrails.after_model(output_state)
            
            # Get potentially modified response (PII redacted, toxic content filtered, etc.)
            if guardrails_output_result and guardrails_output_result.get("messages"):
                modified_messages = guardrails_output_result["messages"]
                if len(modified_messages) > 1:
                    modified_response = modified_messages[-1]
                    if isinstance(modified_response, dict):
                        response = modified_response.get("content", response)
                    elif hasattr(modified_response, "content"):
                        response = getattr(modified_response, "content", response)

            result.success = True
            result.data = {
                "response": response,
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

