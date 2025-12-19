"""Translation Agent - Translates text to multiple languages."""

from typing import Optional, Any, List
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src"))

from identity import Skill, TrustLevel, ActionType
from base import BaseAgent, AgentResult, AgentContext

from ..config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese",
    "ko": "Korean", "ar": "Arabic", "hi": "Hindi", "ru": "Russian",
    "tr": "Turkish", "pl": "Polish", "vi": "Vietnamese", "th": "Thai",
    "id": "Indonesian", "ms": "Malay", "sv": "Swedish", "da": "Danish",
    "no": "Norwegian", "fi": "Finnish", "cs": "Czech", "el": "Greek",
    "he": "Hebrew", "hu": "Hungarian", "ro": "Romanian", "uk": "Ukrainian",
    "nl": "Dutch", "bn": "Bengali",
}


class TranslationAgent(BaseAgent):
    """Agent for translating text to multiple languages."""

    def __init__(self):
        settings = get_settings()

        skills = [
            Skill(
                name="translation",
                confidence_score=0.92,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Translate text between 30+ languages",
            ),
        ]

        super().__init__(
            name="translation-agent",
            agent_type="translation",
            version="2.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
        )

        self.settings = settings
        self._llm = None

    @property
    def llm(self):
        """Lazy load LLM."""
        if self._llm is None:
            if self.settings.default_llm_provider.value == "openai":
                self._llm = ChatOpenAI(
                    model="gpt-4o",
                    api_key=self.settings.openai_api_key,
                    temperature=0.3,
                )
            elif self.settings.default_llm_provider.value == "anthropic":
                self._llm = ChatAnthropic(
                    model="claude-sonnet-4-20250514",
                    api_key=self.settings.anthropic_api_key,
                    temperature=0.3,
                )
            else:
                self._llm = ChatOpenAI(
                    model=self.settings.openrouter_model,
                    api_key=self.settings.openrouter_api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.3,
                )
        return self._llm

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Translate text to target languages.

        Args:
            input_data: Dict with 'text', 'target_languages' (list of language codes)

        Returns:
            AgentResult with translations
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            text = input_data.get("text")
            target_languages = input_data.get("target_languages", [])

            if not text:
                result.error = "No text provided for translation"
                result.mark_complete()
                return result

            if not target_languages:
                result.error = "No target languages specified"
                result.mark_complete()
                return result

            translations = []

            for lang_code in target_languages:
                if lang_code not in SUPPORTED_LANGUAGES:
                    self.logger.warning(f"Unsupported language: {lang_code}")
                    continue

                language_name = SUPPORTED_LANGUAGES[lang_code]

                prompt = ChatPromptTemplate.from_messages([
                    ("system", f"""You are a professional translator. Translate the following text to {language_name}.

Guidelines:
- Maintain the original meaning and tone
- Preserve proper nouns appropriately
- Handle idioms naturally in the target language
- Return only the translated text, no explanations"""),
                    ("human", "{text}"),
                ])

                chain = prompt | self.llm | StrOutputParser()
                translated_text = await chain.ainvoke({"text": text})

                translations.append({
                    "target_language": lang_code,
                    "language_name": language_name,
                    "translated_text": translated_text.strip(),
                })

            result.success = True
            result.data = {
                "translations": translations,
                "source_text": text[:200] + "..." if len(text) > 200 else text,
                "languages_translated": len(translations),
            }
            result.metadata = {
                "model": self.settings.openrouter_model,
            }

        except Exception as e:
            self.logger.exception("Translation failed")
            result.error = str(e)

        result.mark_complete()
        return result
