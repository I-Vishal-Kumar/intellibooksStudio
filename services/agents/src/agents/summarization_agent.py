"""Summarization Agent - Generates summaries with key points."""

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


class SummaryOutput(BaseModel):
    """Structured summary output."""
    summary: str = Field(description="The main summary text")
    key_points: List[str] = Field(description="List of key points")
    main_topics: List[str] = Field(description="Main topics discussed")
    action_items: Optional[List[str]] = Field(default=None, description="Action items if any")


class SummarizationAgent(BaseAgent):
    """Agent for generating summaries with key points and action items."""

    def __init__(self):
        settings = get_settings()

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
                    temperature=0.5,
                )
            elif self.settings.default_llm_provider.value == "anthropic":
                base_llm = ChatAnthropic(
                    model="claude-sonnet-4-20250514",
                    api_key=self.settings.anthropic_api_key,
                    temperature=0.5,
                )
            else:
                base_llm = ChatOpenAI(
                    model=self.settings.openrouter_model,
                    api_key=self.settings.openrouter_api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.5,
                )
            self._llm = base_llm.with_structured_output(SummaryOutput)
        return self._llm

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
                "model": self.settings.openrouter_model,
                "input_length": len(text),
            }

        except Exception as e:
            self.logger.exception("Summarization failed")
            result.error = str(e)

        result.mark_complete()
        return result
