"""Intent Detection Agent - Classifies intent and sentiment."""

from typing import Optional, Any, List
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src"))

from identity import Skill, TrustLevel, ActionType
from base import BaseAgent, AgentResult, AgentContext

from ..config import get_settings

logger = logging.getLogger(__name__)


class IntentOutput(BaseModel):
    """Structured intent detection output."""
    primary_intent: str = Field(description="Primary intent category")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")
    secondary_intents: List[str] = Field(default_factory=list, description="Secondary intents")
    reasoning: str = Field(description="Explanation for the classification")
    sentiment: str = Field(description="Overall sentiment: positive, negative, neutral, mixed")
    urgency: str = Field(description="Urgency level: low, medium, high")


INTENT_CATEGORIES = [
    "inquiry", "complaint", "feedback", "request",
    "information", "support", "sales", "other"
]


class IntentDetectionAgent(BaseAgent):
    """Agent for detecting intent and sentiment from text."""

    def __init__(self):
        settings = get_settings()

        skills = [
            Skill(
                name="intent_detection",
                confidence_score=0.88,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Classify text intent, sentiment, and urgency",
            ),
        ]

        super().__init__(
            name="intent-detection-agent",
            agent_type="intent",
            version="2.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
        )

        self.settings = settings
        self._llm = None

    @property
    def llm(self):
        """Lazy load LLM with structured output."""
        if self._llm is None:
            if self.settings.default_llm_provider.value == "openai":
                base_llm = ChatOpenAI(
                    model="gpt-4o",
                    api_key=self.settings.openai_api_key,
                    temperature=0.0,
                )
            elif self.settings.default_llm_provider.value == "anthropic":
                base_llm = ChatAnthropic(
                    model="claude-sonnet-4-20250514",
                    api_key=self.settings.anthropic_api_key,
                    temperature=0.0,
                )
            else:
                base_llm = ChatOpenAI(
                    model=self.settings.openrouter_model,
                    api_key=self.settings.openrouter_api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.0,
                )
            self._llm = base_llm.with_structured_output(IntentOutput)
        return self._llm

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Detect intent and sentiment from text.

        Args:
            input_data: Dict with 'text'

        Returns:
            AgentResult with intent data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")

            if not text:
                result.error = "No text provided for intent detection"
                result.mark_complete()
                return result

            categories_str = ", ".join(INTENT_CATEGORIES)

            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are an expert at analyzing text to understand intent, sentiment, and urgency.

Analyze the provided text and classify it according to:

1. Primary Intent (choose one): {categories_str}
   - inquiry: Questions, seeking information
   - complaint: Expressing dissatisfaction, problems
   - feedback: Providing opinions, suggestions
   - request: Asking for action, service
   - information: Sharing information, updates
   - support: Seeking help, assistance
   - sales: Purchase interest, pricing queries
   - other: Doesn't fit other categories

2. Confidence: How confident are you (0.0-1.0)?

3. Secondary Intents: Any additional intents present?

4. Sentiment: positive, negative, neutral, or mixed

5. Urgency: low, medium, or high

6. Reasoning: Brief explanation for your classification"""),
                ("human", "Analyze the following text:\n\n{text}"),
            ])

            chain = prompt | self.llm
            intent_output: IntentOutput = await chain.ainvoke({"text": text})

            result.success = True
            result.data = {
                "primary_intent": intent_output.primary_intent,
                "confidence": intent_output.confidence,
                "secondary_intents": intent_output.secondary_intents,
                "reasoning": intent_output.reasoning,
                "sentiment": intent_output.sentiment,
                "urgency": intent_output.urgency,
            }
            result.metadata = {
                "model": self.settings.openrouter_model,
            }

        except Exception as e:
            self.logger.exception("Intent detection failed")
            result.error = str(e)

        result.mark_complete()
        return result
