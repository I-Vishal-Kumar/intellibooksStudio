"""Meeting Agenda Extraction Agent - Extracts agenda items and meeting purpose from transcripts."""

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


class AgendaItem(BaseModel):
    """A single agenda item with metadata."""
    topic: str = Field(description="Agenda topic")
    time_mentioned: Optional[str] = Field(default=None, description="When this topic was discussed (if mentioned)")
    key_points: List[str] = Field(description="Key points discussed under this topic")


class AgendaOutput(BaseModel):
    """Structured agenda extraction output."""
    agenda_items: List[AgendaItem] = Field(description="List of agenda items")
    meeting_purpose: str = Field(description="Overall purpose of the meeting")


class AgendaExtractionAgent(BaseAgent):
    """Agent for extracting meeting agenda and purpose from transcripts."""

    def __init__(self):
        skills = [
            Skill(
                name="agenda_extraction",
                confidence_score=0.88,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Extract meeting agenda, topics, and purpose from transcripts",
            ),
        ]

        super().__init__(
            name="agenda-extraction-agent",
            agent_type="extraction",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            llm_settings=create_llm_settings(),
            default_temperature=0.3,  # Lower temperature for consistent extraction
        )

    def _create_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None):
        """Override to always use structured output for agenda extraction."""
        temp = temperature if temperature is not None else 0.3
        output_schema = structured_output if structured_output is not None else AgendaOutput
        return super()._create_llm(temperature=temp, structured_output=output_schema)

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Extract meeting agenda from transcript.

        Args:
            input_data: Dict with 'text'

        Returns:
            AgentResult with agenda data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")

            if not text:
                result.error = "No text provided for agenda extraction"
                result.mark_complete()
                return result

            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are an expert at extracting meeting agendas and identifying discussion topics from transcripts.

Extract:
- Main topics discussed (agenda items)
- Meeting purpose/objective
- Key points for each topic
- Any time references if mentioned

Focus on identifying the structure and flow of the meeting."""),
                ("human", "Extract the agenda and meeting purpose from this transcript:\n\n{text}"),
            ])

            # Use base LLM property which will use structured output from _create_llm override
            chain = prompt | self.llm
            agenda_output: AgendaOutput = await chain.ainvoke({"text": text})

            # Format agenda items for response
            formatted_agenda_items = [
                {
                    "topic": item.topic,
                    "time_mentioned": item.time_mentioned,
                    "key_points": item.key_points,
                }
                for item in agenda_output.agenda_items
            ]

            result.success = True
            result.data = {
                "agenda_items": formatted_agenda_items,
                "meeting_purpose": agenda_output.meeting_purpose,
                "total_topics": len(formatted_agenda_items),
            }
            result.metadata = {
                "input_length": len(text),
            }

        except Exception as e:
            self.logger.exception("Agenda extraction failed")
            result.error = str(e)

        result.mark_complete()
        return result

