"""Keyword Extraction Agent - Extracts keywords, keyphrases, and entities."""

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


class KeywordItem(BaseModel):
    """A single keyword/phrase with metadata."""
    text: str = Field(description="The keyword or phrase")
    type: str = Field(description="Type: keyword, keyphrase, or entity")
    relevance_score: float = Field(ge=0.0, le=1.0, description="Relevance score")
    context: Optional[str] = Field(default=None, description="Context where it appears")


class KeywordOutput(BaseModel):
    """Structured keyword extraction output."""
    keywords: List[KeywordItem] = Field(description="Extracted keywords and phrases")
    main_theme: str = Field(description="Overall theme of the content")
    domain: str = Field(description="Domain/category of the content")


class KeywordExtractionAgent(BaseAgent):
    """Agent for extracting keywords, keyphrases, and named entities."""

    def __init__(self):
        settings = get_settings()

        skills = [
            Skill(
                name="keyword_extraction",
                confidence_score=0.87,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Extract keywords, keyphrases, and named entities",
            ),
        ]

        super().__init__(
            name="keyword-extraction-agent",
            agent_type="keyword",
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
            self._llm = base_llm.with_structured_output(KeywordOutput)
        return self._llm

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Extract keywords and entities from text.

        Args:
            input_data: Dict with 'text', optional 'max_keywords'

        Returns:
            AgentResult with keyword data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")
            max_keywords = input_data.get("max_keywords", 10)

            if not text:
                result.error = "No text provided for keyword extraction"
                result.mark_complete()
                return result

            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are an expert at extracting keywords, keyphrases, and named entities from text.

Extract up to {max_keywords} items from the provided text:

1. Keywords: Important single words (nouns, verbs, adjectives)
2. Keyphrases: Multi-word expressions (2-4 words)
3. Entities: Named entities (people, organizations, products, places)

For each item, provide:
- The text itself
- Type (keyword, keyphrase, or entity)
- Relevance score (0.0-1.0)
- Brief context (optional)

Also identify:
- Main theme: Overall topic/theme
- Domain: Category (technology, healthcare, business, education, etc.)

Focus on terms that are most important for understanding the content."""),
                ("human", "Extract keywords from this text:\n\n{text}"),
            ])

            chain = prompt | self.llm
            keyword_output: KeywordOutput = await chain.ainvoke({"text": text})

            # Format keywords for response
            formatted_keywords = [
                {
                    "keyword": kw.text,
                    "type": kw.type,
                    "relevance_score": kw.relevance_score,
                    "context": kw.context,
                }
                for kw in keyword_output.keywords
            ]

            result.success = True
            result.data = {
                "keywords": formatted_keywords,
                "main_theme": keyword_output.main_theme,
                "domain": keyword_output.domain,
                "total_keywords": len(formatted_keywords),
            }
            result.metadata = {
                "model": self.settings.openrouter_model,
            }

        except Exception as e:
            self.logger.exception("Keyword extraction failed")
            result.error = str(e)

        result.mark_complete()
        return result
