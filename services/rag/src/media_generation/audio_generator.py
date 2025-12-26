"""Audio Generator using Edge TTS for document audio summaries."""

import asyncio
import logging
import os
import time
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AudioFormat(str, Enum):
    """Audio output formats."""
    DEEP_DIVE = "deep_dive"  # Detailed, comprehensive analysis
    BRIEF = "brief"  # Quick summary
    CRITIQUE = "critique"  # Critical analysis
    DEBATE = "debate"  # Multiple perspectives


class AudioLength(str, Enum):
    """Audio length options."""
    SHORT = "short"  # ~2-3 minutes
    DEFAULT = "default"  # ~5-7 minutes
    LONG = "long"  # ~10-15 minutes


@dataclass
class AudioConfig:
    """Configuration for audio generation."""
    format: AudioFormat = AudioFormat.DEEP_DIVE
    language: str = "en-US"
    length: AudioLength = AudioLength.DEFAULT
    custom_topic: Optional[str] = None
    voice: str = "en-US-AriaNeural"  # Default Microsoft Edge voice


@dataclass
class AudioResult:
    """Result of audio generation."""
    success: bool
    audio_path: Optional[str] = None
    duration_seconds: float = 0.0
    file_size_bytes: int = 0
    title: str = ""
    processing_time_ms: float = 0.0
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# Voice mapping for different languages
VOICE_MAP = {
    "en-US": "en-US-AriaNeural",
    "en-GB": "en-GB-SoniaNeural",
    "es-ES": "es-ES-ElviraNeural",
    "es-MX": "es-MX-DaliaNeural",
    "fr-FR": "fr-FR-DeniseNeural",
    "de-DE": "de-DE-KatjaNeural",
    "it-IT": "it-IT-ElsaNeural",
    "pt-BR": "pt-BR-FranciscaNeural",
    "zh-CN": "zh-CN-XiaoxiaoNeural",
    "ja-JP": "ja-JP-NanamiNeural",
    "ko-KR": "ko-KR-SunHiNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "ar-SA": "ar-SA-ZariyahNeural",
    "ru-RU": "ru-RU-SvetlanaNeural",
    # Indian languages
    "bn-IN": "bn-IN-TanishaaNeural",  # Bengali
    "gu-IN": "gu-IN-DhwaniNeural",  # Gujarati
    "kn-IN": "kn-IN-SapnaNeural",  # Kannada
    "ml-IN": "ml-IN-SobhanaNeural",  # Malayalam
    "mr-IN": "mr-IN-AarohiNeural",  # Marathi
    "pa-IN": "pa-IN-GundeepNeural",  # Punjabi
    "ta-IN": "ta-IN-PallaviNeural",  # Tamil
    "te-IN": "te-IN-ShrutiNeural",  # Telugu
}

# Length word limits
LENGTH_LIMITS = {
    AudioLength.SHORT: 500,  # ~2-3 min
    AudioLength.DEFAULT: 1200,  # ~5-7 min
    AudioLength.LONG: 2500,  # ~10-15 min
}


class AudioGenerator:
    """
    Generates audio summaries from document content using Edge TTS.

    Uses Microsoft Edge's free text-to-speech service for high-quality
    neural voices in multiple languages.
    """

    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else Path("data/audio_output")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate_audio_summary(
        self,
        document_content: str,
        document_title: str,
        config: AudioConfig,
        session_id: Optional[str] = None,
    ) -> AudioResult:
        """
        Generate an audio summary from document content.

        Args:
            document_content: The full text content of the document(s)
            document_title: Title for the audio
            config: Audio generation configuration
            session_id: Optional session ID for file organization

        Returns:
            AudioResult with path to generated audio file
        """
        start_time = time.time()

        try:
            import edge_tts

            # Generate script based on format and length
            script = await self._generate_script(
                document_content, document_title, config
            )

            if not script:
                return AudioResult(
                    success=False,
                    error="Failed to generate audio script",
                    processing_time_ms=(time.time() - start_time) * 1000,
                )

            # Get appropriate voice
            voice = VOICE_MAP.get(config.language, config.voice)

            # Generate unique filename
            content_hash = hashlib.md5(script.encode()).hexdigest()[:8]
            timestamp = int(time.time())
            filename = f"audio_{timestamp}_{content_hash}.mp3"

            if session_id:
                session_dir = self.output_dir / session_id
                session_dir.mkdir(parents=True, exist_ok=True)
                output_path = session_dir / filename
            else:
                output_path = self.output_dir / filename

            # Generate audio using Edge TTS
            logger.info(f"Generating audio with voice {voice}...")
            communicate = edge_tts.Communicate(script, voice)
            await communicate.save(str(output_path))

            # Get file info
            file_size = output_path.stat().st_size

            # Estimate duration (rough estimate: ~150 words per minute)
            word_count = len(script.split())
            duration_seconds = (word_count / 150) * 60

            logger.info(f"Audio generated: {output_path} ({file_size} bytes, ~{duration_seconds:.0f}s)")

            return AudioResult(
                success=True,
                audio_path=str(output_path),
                duration_seconds=duration_seconds,
                file_size_bytes=file_size,
                title=document_title,
                processing_time_ms=(time.time() - start_time) * 1000,
                metadata={
                    "voice": voice,
                    "language": config.language,
                    "format": config.format.value,
                    "word_count": word_count,
                },
            )

        except ImportError:
            return AudioResult(
                success=False,
                error="edge-tts package not installed. Run: pip install edge-tts",
                processing_time_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            logger.exception(f"Audio generation failed: {e}")
            return AudioResult(
                success=False,
                error=str(e),
                processing_time_ms=(time.time() - start_time) * 1000,
            )

    async def _generate_script(
        self,
        content: str,
        title: str,
        config: AudioConfig,
    ) -> Optional[str]:
        """Generate the audio script using LLM."""
        try:
            from openai import AsyncOpenAI
            from ..config import get_settings

            settings = get_settings()

            if not settings.openrouter_api_key:
                # Fallback: Create simple script from content
                return self._create_simple_script(content, title, config)

            client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.openrouter_api_key,
            )

            word_limit = LENGTH_LIMITS.get(config.length, 1200)

            format_instructions = {
                AudioFormat.DEEP_DIVE: "Create a comprehensive, detailed analysis that explores all key aspects, provides context, and offers insights. Structure it like a podcast episode with clear sections.",
                AudioFormat.BRIEF: "Create a concise summary hitting only the most important points. Be direct and efficient.",
                AudioFormat.CRITIQUE: "Analyze the content critically, identifying strengths, weaknesses, and areas for improvement. Provide balanced perspective.",
                AudioFormat.DEBATE: "Present multiple perspectives on the key topics, as if two hosts are discussing and sometimes disagreeing. Use 'Host 1:' and 'Host 2:' markers.",
            }

            topic_focus = ""
            if config.custom_topic:
                topic_focus = f"\n\nFocus especially on: {config.custom_topic}"

            prompt = f"""Create an engaging audio script for a document summary podcast episode.

Document Title: {title}

Document Content:
{content[:8000]}  # Limit content length

Instructions:
{format_instructions.get(config.format, format_instructions[AudioFormat.DEEP_DIVE])}

Target length: approximately {word_limit} words
{topic_focus}

Guidelines:
- Write in a conversational, engaging tone suitable for audio
- Start with a brief introduction
- Use clear transitions between topics
- End with a conclusion or key takeaways
- Do NOT include any stage directions, sound effects, or non-spoken text
- Write exactly what should be spoken aloud

Generate the script now:"""

            response = await client.chat.completions.create(
                model=settings.openrouter_model,
                messages=[
                    {"role": "system", "content": "You are an expert podcast script writer. Create engaging, natural-sounding scripts that work well when read aloud."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=3000,
            )

            script = response.choices[0].message.content
            return script.strip()

        except Exception as e:
            logger.warning(f"LLM script generation failed: {e}, using simple script")
            return self._create_simple_script(content, title, config)

    def _create_simple_script(
        self,
        content: str,
        title: str,
        config: AudioConfig,
    ) -> str:
        """Create a simple script without LLM."""
        word_limit = LENGTH_LIMITS.get(config.length, 1200)

        # Extract first N words from content
        words = content.split()[:word_limit]
        truncated_content = " ".join(words)

        script = f"""Welcome to this audio summary of {title}.

Let me walk you through the key points from this document.

{truncated_content}

That concludes our summary of {title}. Thank you for listening."""

        return script

    @staticmethod
    async def list_voices(language: Optional[str] = None) -> List[Dict[str, str]]:
        """List available Edge TTS voices."""
        try:
            import edge_tts
            voices = await edge_tts.list_voices()

            if language:
                voices = [v for v in voices if v.get("Locale", "").startswith(language)]

            return [
                {
                    "name": v.get("ShortName", ""),
                    "locale": v.get("Locale", ""),
                    "gender": v.get("Gender", ""),
                }
                for v in voices
            ]
        except Exception as e:
            logger.error(f"Failed to list voices: {e}")
            return []
