"""Intent Detection Agent - Classifies intent and sentiment."""

from typing import Optional, Any, List
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src"))

from identity import Skill, TrustLevel, ActionType
from base import BaseAgent, AgentResult, AgentContext

from ..llm_factory import create_llm_settings

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
            llm_settings=create_llm_settings(),
            default_temperature=0.0,  # Intent detection needs deterministic output
        )

    def _create_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None):
        """Override to always use structured output and temperature 0.0 for intent detection."""
        # Use temperature 0.0 for deterministic intent classification
        temp = temperature if temperature is not None else 0.0
        # Always use IntentOutput unless explicitly overridden
        output_schema = structured_output if structured_output is not None else IntentOutput
        return super()._create_llm(temperature=temp, structured_output=output_schema)

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

            # Use base LLM property which will use structured output from _create_llm override
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
            result.metadata = {}

        except Exception as e:
            self.logger.exception("Intent detection failed")
            result.error = str(e)

        result.mark_complete()
        return result
