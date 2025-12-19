"""Transcription Agent - Converts audio to text using Whisper."""

import os
import subprocess
from pathlib import Path
from typing import Optional, Any, Dict, TYPE_CHECKING
import logging

# Add agent framework to path
import sys
_agent_framework_path = str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src")
if _agent_framework_path not in sys.path:
    sys.path.insert(0, _agent_framework_path)

# Import agent framework components using absolute imports
from identity.card import AgentIdentityCard, Skill, TrustLevel, ActionType
from dna.blueprint import AgentDNABlueprint, create_standard_blueprint
from base.agent import BaseAgent, AgentResult, AgentContext

from ..config import get_settings

logger = logging.getLogger(__name__)

# Lazy imports for heavy dependencies
np = None
whisper = None
torch = None


def _ensure_dependencies():
    """Lazy load heavy dependencies."""
    global np, whisper, torch
    if np is None:
        import numpy
        np = numpy
    if whisper is None:
        import whisper as whisper_module
        whisper = whisper_module
    if torch is None:
        import torch as torch_module
        torch = torch_module


def _get_ffmpeg_path():
    """Get FFmpeg path from imageio-ffmpeg."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def _load_audio_with_ffmpeg(file_path: str, sr: int = 16000):
    """Load audio using FFmpeg."""
    _ensure_dependencies()
    ffmpeg_path = _get_ffmpeg_path()

    cmd = [
        ffmpeg_path,
        "-nostdin",
        "-threads", "0",
        "-i", file_path,
        "-f", "s16le",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-ar", str(sr),
        "-"
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, err = process.communicate()

    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {err.decode()}")

    audio = np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0
    return audio


class TranscriptionAgent(BaseAgent):
    """Agent for transcribing audio files to text using OpenAI Whisper."""

    def __init__(self):
        settings = get_settings()

        skills = [
            Skill(
                name="transcription",
                confidence_score=0.95,
                input_types=["audio/mp3", "audio/wav", "audio/flac", "audio/m4a", "audio/ogg"],
                output_types=["text/plain"],
                description="Transcribe audio files to text with high accuracy",
            ),
            Skill(
                name="language_detection",
                confidence_score=0.90,
                input_types=["audio/*"],
                output_types=["text/plain"],
                description="Detect the language of spoken audio",
            ),
        ]

        super().__init__(
            name="transcription-agent",
            agent_type="transcription",
            version="2.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
        )

        self._whisper_model = None
        self._model_name = settings.whisper_model.value

    @property
    def whisper_model(self):
        """Lazy load Whisper model."""
        _ensure_dependencies()
        if self._whisper_model is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.logger.info(f"Loading Whisper model '{self._model_name}' on {device}")
            self._whisper_model = whisper.load_model(self._model_name, device=device)
        return self._whisper_model

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Transcribe an audio file.

        Args:
            input_data: Dict with 'audio_file_path', optional 'language', 'include_timestamps'

        Returns:
            AgentResult with transcription data
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            audio_file_path = input_data.get("audio_file_path")
            language = input_data.get("language")
            include_timestamps = input_data.get("include_timestamps", False)

            if not audio_file_path or not Path(audio_file_path).exists():
                result.error = f"Audio file not found: {audio_file_path}"
                result.mark_complete()
                return result

            # Transcribe options
            transcribe_options = {
                "fp16": torch.cuda.is_available(),
                "verbose": False,
            }

            if language:
                transcribe_options["language"] = language

            if include_timestamps:
                transcribe_options["word_timestamps"] = True

            # Load audio with our FFmpeg wrapper
            self.logger.info(f"Loading audio from: {audio_file_path}")
            audio = _load_audio_with_ffmpeg(audio_file_path, sr=16000)
            self.logger.info(f"Audio loaded, duration: {len(audio) / 16000:.2f}s")

            # Transcribe
            whisper_result = self.whisper_model.transcribe(audio, **transcribe_options)

            # Extract data
            transcription_data = {
                "text": whisper_result["text"].strip(),
                "language": whisper_result.get("language", language or "en"),
                "segments": whisper_result.get("segments", []),
            }

            # Extract word timestamps if available
            word_timestamps = None
            if include_timestamps and "segments" in whisper_result:
                word_timestamps = []
                for segment in whisper_result["segments"]:
                    if "words" in segment:
                        word_timestamps.extend(segment["words"])

            result.success = True
            result.data = {
                "text": transcription_data["text"],
                "language": transcription_data["language"],
                "word_count": len(transcription_data["text"].split()),
                "segments_count": len(transcription_data["segments"]),
                "word_timestamps": word_timestamps,
            }
            result.metadata = {
                "model": f"whisper-{self._model_name}",
                "audio_file": audio_file_path,
            }

        except Exception as e:
            self.logger.exception("Transcription failed")
            result.error = str(e)

        result.mark_complete()
        return result
