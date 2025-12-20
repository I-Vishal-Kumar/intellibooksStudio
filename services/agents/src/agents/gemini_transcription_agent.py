"""Deepgram Transcription Agent - Uses Deepgram API for audio transcription."""

import logging
import tempfile
from pathlib import Path
from typing import Optional, Any, Dict
import httpx
import json

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src"))

from identity import Skill, TrustLevel, ActionType
from base import BaseAgent, AgentResult, AgentContext

from ..llm_factory import create_llm_settings
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def convert_webm_to_wav(webm_data: bytes) -> bytes:
    """
    Convert WebM audio to WAV format using FFmpeg.
    Returns WAV file as bytes.
    """
    import subprocess
    import os
    
    # Create temporary files
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as webm_file:
        webm_file.write(webm_data)
        webm_path = webm_file.name
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
        wav_path = wav_file.name
    
    try:
        # Use FFmpeg to convert
        try:
            import imageio_ffmpeg
            ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            ffmpeg_path = "ffmpeg"
        
        cmd = [
            ffmpeg_path,
            "-i", webm_path,
            "-ar", "16000",  # Sample rate
            "-ac", "1",  # Mono
            "-f", "wav",
            "-y",  # Overwrite output
            wav_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg conversion failed: {result.stderr}")
        
        # Read converted WAV file
        with open(wav_path, "rb") as f:
            wav_data = f.read()
        
        return wav_data
    
    finally:
        # Cleanup temp files
        try:
            os.unlink(webm_path)
            os.unlink(wav_path)
        except:
            pass


class GeminiTranscriptionAgent(BaseAgent):
    """Agent for transcribing audio using Deepgram API."""

    def __init__(self):
        skills = [
            Skill(
                name="audio_transcription",
                confidence_score=0.90,
                input_types=["audio/wav", "audio/webm", "audio/mp3"],
                output_types=["text/plain"],
                description="Transcribe audio files using Deepgram API",
            ),
        ]

        super().__init__(
            name="deepgram-transcription-agent",
            agent_type="transcription",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            llm_settings=create_llm_settings(),
            default_temperature=0.0,  # Not used for Deepgram
        )

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Transcribe audio using Deepgram API.

        Args:
            input_data: Dict with:
                - 'audio_data': bytes - Audio file bytes
                - 'audio_file_path': str - Path to audio file (alternative to audio_data)
                - 'mime_type': str - MIME type (default: "audio/wav")

        Returns:
            AgentResult with transcription text
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)

        try:
            # Get audio data
            audio_data = input_data.get("audio_data")
            audio_file_path = input_data.get("audio_file_path")
            mime_type = input_data.get("mime_type", "audio/wav")

            # Load audio if file path provided
            if audio_file_path and not audio_data:
                if not Path(audio_file_path).exists():
                    result.error = f"Audio file not found: {audio_file_path}"
                    result.mark_complete()
                    return result
                with open(audio_file_path, "rb") as f:
                    audio_data = f.read()

            if not audio_data:
                result.error = "No audio data provided"
                result.mark_complete()
                return result

            # Convert WebM to WAV if needed
            if "webm" in mime_type.lower():
                logger.info("Converting WebM to WAV...")
                try:
                    audio_data = convert_webm_to_wav(audio_data)
                    mime_type = "audio/wav"
                except Exception as e:
                    result.error = f"Failed to convert WebM to WAV: {str(e)}"
                    result.mark_complete()
                    return result

            # Use Deepgram API for transcription
            transcription = await self._transcribe_with_deepgram(audio_data, mime_type)

            result.success = True
            result.data = {
                "text": transcription,
                "mime_type": mime_type,
                "audio_size": len(audio_data),
            }
            result.metadata = {
                "audio_size": len(audio_data),
                "transcription_length": len(transcription),
            }

        except Exception as e:
            self.logger.exception("Deepgram transcription agent execution failed")
            result.error = str(e)

        result.mark_complete()
        return result

    async def _transcribe_with_deepgram(self, audio_data: bytes, mime_type: str) -> str:
        """
        Transcribe audio using Deepgram API.

        Args:
            audio_data: Raw audio bytes
            mime_type: MIME type of the audio

        Returns:
            Transcribed text
        """
        if not settings.deepgram_api_key:
            raise ValueError("Deepgram API key not configured")

        # Deepgram API endpoint with parameters
        url = "https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2&punctuate=true&diarize=false"
        
        # Headers
        headers = {
            "Authorization": f"Token {settings.deepgram_api_key}",
            "Content-Type": mime_type,  # e.g., "audio/wav"
        }

        try:
            logger.info(f"Sending transcription request to Deepgram (audio size: {len(audio_data)} bytes)")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, content=audio_data, headers=headers)
                response.raise_for_status()
                
                # Parse JSON response
                result = response.json()
                logger.debug(f"Deepgram response: {result}")
                
                # Extract transcript from Deepgram response structure
                # Structure: result.results.channels[0].alternatives[0].transcript
                if (
                    "results" in result
                    and "channels" in result["results"]
                    and len(result["results"]["channels"]) > 0
                    and "alternatives" in result["results"]["channels"][0]
                    and len(result["results"]["channels"][0]["alternatives"]) > 0
                ):
                    transcript = result["results"]["channels"][0]["alternatives"][0].get("transcript", "")
                    transcript_text = transcript.strip()
                    
                    if transcript_text:
                        logger.info(f"Transcription successful, length: {len(transcript_text)}")
                        return transcript_text
                    else:
                        logger.warning("Empty transcription result from Deepgram")
                        return ""
                else:
                    logger.error(f"Unexpected Deepgram response structure: {result}")
                    raise ValueError("Unexpected response format from Deepgram API")

        except httpx.HTTPStatusError as e:
            error_text = e.response.text if e.response else "Unknown error"
            logger.error(f"Deepgram API error ({e.response.status_code}): {error_text}")
            raise ValueError(f"Deepgram API error: status {e.response.status_code}, {error_text}")
        except httpx.TimeoutException:
            logger.error("Deepgram API request timed out")
            raise ValueError("Deepgram API request timed out")
        except Exception as e:
            logger.exception("Error calling Deepgram API")
            raise ValueError(f"Transcription API error: {str(e)}")

