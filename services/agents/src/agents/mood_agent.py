"""Mood Analysis Agent - Analyzes mood and emotional tone from text."""

from typing import Optional, Any, List
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
import logging

import sys
_agent_framework_path = str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src")
if _agent_framework_path not in sys.path:
    sys.path.insert(0, _agent_framework_path)

from identity.card import Skill, TrustLevel, ActionType
from base.agent import BaseAgent, AgentResult, AgentContext

from ..llm_factory import create_llm_settings

logger = logging.getLogger(__name__)


class MoodOutput(BaseModel):
    """Structured mood analysis output."""
    overall_mood: str = Field(description="Overall mood: positive, neutral, negative, or mixed")
    sentiment_score: float = Field(ge=-1.0, le=1.0, description="Sentiment score from -1 (negative) to 1 (positive)")
    emotional_tone: str = Field(description="Emotional tone: professional, casual, formal, friendly, tense, etc.")
    stress_level: str = Field(description="Stress level: low, medium, high")
    engagement_level: str = Field(description="Engagement level: low, medium, high")


class MoodAnalysisAgent(BaseAgent):
    """Agent for analyzing mood and emotional tone from text."""

    def __init__(self):
        skills = [
            Skill(
                name="mood_analysis",
                confidence_score=0.85,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Analyze mood, sentiment, and emotional tone from text",
            ),
        ]

        super().__init__(
            name="mood-analysis-agent",
            agent_type="analysis",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            llm_settings=create_llm_settings(),
            default_temperature=0.3,  # Lower temperature for more consistent mood analysis
        )

    def _create_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None):
        """Override to always use structured output for mood analysis."""
        temp = temperature if temperature is not None else 0.3
        output_schema = structured_output if structured_output is not None else MoodOutput
        return super()._create_llm(temperature=temp, structured_output=output_schema)

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Analyze mood and emotional tone from text.

        Args:
            input_data: Dict with 'text', optional 'include_diarization' for speaker-specific analysis

        Returns:
            AgentResult with mood analysis data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")
            include_diarization = input_data.get("include_diarization", False)

            if not text:
                result.error = "No text provided for mood analysis"
                result.mark_complete()
                return result

            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert at analyzing mood, sentiment, and emotional tone from meeting transcripts.

Analyze the following aspects:
- Overall sentiment (positive, neutral, negative, mixed)
- Emotional tone (professional, casual, formal, friendly, tense, etc.)
- Stress indicators and level
- Engagement level
- Conversational dynamics

Be objective and consider the context of a business or professional meeting."""),
                ("human", "Analyze the mood and emotional tone of this meeting transcript:\n\n{text}"),
            ])

            # Use base LLM property which will use structured output from _create_llm override
            chain = prompt | self.llm
            mood_output: MoodOutput = await chain.ainvoke({"text": text})

            result.success = True
            result.data = {
                "overall_mood": mood_output.overall_mood,
                "sentiment_score": mood_output.sentiment_score,
                "emotional_tone": mood_output.emotional_tone,
                "stress_level": mood_output.stress_level,
                "engagement_level": mood_output.engagement_level,
            }
            result.metadata = {
                "input_length": len(text),
                "include_diarization": include_diarization,
            }

        except Exception as e:
            self.logger.exception("Mood analysis failed")
            result.error = str(e)

        result.mark_complete()
        return result

