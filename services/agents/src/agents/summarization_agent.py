"""Summarization Agent - Generates summaries with key points."""

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


class SummaryOutput(BaseModel):
    """Structured summary output."""
    summary: str = Field(description="The main summary text")
    key_points: List[str] = Field(description="List of key points")
    main_topics: List[str] = Field(description="Main topics discussed")
    action_items: Optional[List[str]] = Field(default=None, description="Action items if any")


class SummarizationAgent(BaseAgent):
    """Agent for generating summaries with key points and action items."""

    def __init__(self):
        skills = [
            Skill(
                name="summarization",
                confidence_score=0.90,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Generate summaries with key points and action items",
            ),
        ]

        super().__init__(
            name="summarization-agent",
            agent_type="summarization",
            version="2.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            llm_settings=create_llm_settings(),
            default_temperature=0.5,  # Summarization works well with moderate temperature
        )

    def _create_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None):
        """Override to always use structured output for summaries."""
        # Use temperature 0.5 for summarization (can be overridden)
        temp = temperature if temperature is not None else 0.5
        # Always use SummaryOutput unless explicitly overridden
        output_schema = structured_output if structured_output is not None else SummaryOutput
        return super()._create_llm(temperature=temp, structured_output=output_schema)

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Generate a summary of the text.

        Args:
            input_data: Dict with 'text', optional 'summary_type'

        Returns:
            AgentResult with summary data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")
            summary_type = input_data.get("summary_type", "general")

            if not text:
                result.error = "No text provided for summarization"
                result.mark_complete()
                return result

            # Build prompt based on summary type
            type_instructions = {
                "general": "Provide a comprehensive summary with key points and main topics.",
                "key_points": "Focus on extracting the most important points and insights.",
                "action_items": "Focus on extracting actionable items, tasks, and next steps.",
                "quick": "Provide a brief 1-2 sentence summary capturing the essence.",
            }

            instruction = type_instructions.get(summary_type, type_instructions["general"])

            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are an expert at analyzing and summarizing content.
{instruction}

For the summary:
- Be concise but comprehensive
- Maintain accuracy to the source
- Identify themes and patterns

For key points:
- List 3-7 most important points
- Each point should be a complete thought

For main topics:
- Identify 2-5 main topics/themes
- Use short descriptive phrases

For action items (if applicable):
- Extract any tasks, to-dos, or next steps mentioned
- Format as actionable items"""),
                ("human", "Please analyze and summarize the following text:\n\n{text}"),
            ])

            # Use base LLM property which will use structured output from _create_llm override
            chain = prompt | self.llm
            summary_output: SummaryOutput = await chain.ainvoke({"text": text})

            result.success = True
            result.data = {
                "summary": summary_output.summary,
                "key_points": summary_output.key_points,
                "main_topics": summary_output.main_topics,
                "action_items": summary_output.action_items,
                "summary_type": summary_type,
            }
            result.metadata = {
                "input_length": len(text),
            }

        except Exception as e:
            self.logger.exception("Summarization failed")
            result.error = str(e)

        result.mark_complete()
        return result
