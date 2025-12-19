"""Translation Agent - Translates text to multiple languages."""

from typing import Optional, Any, List
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
            llm_settings=create_llm_settings(),
            default_temperature=0.3,  # Translation needs moderate creativity
        )

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

                # Use base LLM with translation temperature
                llm = self.get_llm(temperature=0.3)
                chain = prompt | llm | StrOutputParser()
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
            result.metadata = {}

        except Exception as e:
            self.logger.exception("Translation failed")
            result.error = str(e)

        result.mark_complete()
        return result
