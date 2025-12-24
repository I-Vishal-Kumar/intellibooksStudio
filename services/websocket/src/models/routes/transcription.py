"""Audio transcription endpoint using Gemini via OpenRouter."""

import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from ...config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transcription", tags=["transcription"])

settings = get_settings()

# Import Gemini Transcription Agent
try:
    from services.agents.src.agents.gemini_transcription_agent import GeminiTranscriptionAgent
    logger.debug("Imported GeminiTranscriptionAgent from installed package")
except ImportError:
    try:
        from agents.src.agents.gemini_transcription_agent import GeminiTranscriptionAgent
        logger.debug("Imported GeminiTranscriptionAgent via direct import")
    except ImportError:
        import sys
        project_root = Path(__file__).parent.parent.parent.parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        try:
            from services.agents.src.agents.gemini_transcription_agent import GeminiTranscriptionAgent
            logger.info(f"Imported GeminiTranscriptionAgent by adding project root to path: {project_root}")
        except ImportError as e:
            logger.error(f"Failed to import GeminiTranscriptionAgent: {e}")
            GeminiTranscriptionAgent = None


class TranscriptionResponse(BaseModel):
    """Response model for transcription."""
    success: bool
    text: Optional[str] = None
    error: Optional[str] = None


# Initialize agent instance
_transcription_agent: Optional[GeminiTranscriptionAgent] = None


async def get_transcription_agent() -> GeminiTranscriptionAgent:
    """Get or create the transcription agent instance."""
    global _transcription_agent
    if _transcription_agent is None:
        if GeminiTranscriptionAgent is None:
            raise HTTPException(
                status_code=500,
                detail="GeminiTranscriptionAgent not available. Please check service setup."
            )
        _transcription_agent = GeminiTranscriptionAgent()
        if not _transcription_agent._is_initialized:
            await _transcription_agent.initialize()
    return _transcription_agent


# Audio conversion is now handled by GeminiTranscriptionAgent




@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio file using Gemini via OpenRouter.
    
    Accepts audio files in WAV or WebM format.
    WebM files will be automatically converted to WAV.
    """
    try:
        # Read audio file
        audio_data = await file.read()
        
        if not audio_data:
            raise HTTPException(status_code=400, detail="Empty audio file")
        
        # Determine MIME type from content type or filename
        content_type = file.content_type or ""
        mime_type = content_type if content_type else "audio/wav"
        
        # If no content type, try to infer from filename
        if not mime_type or mime_type == "application/octet-stream":
            if file.filename:
                ext = file.filename.split(".")[-1].lower()
                mime_type_map = {
                    "wav": "audio/wav",
                    "webm": "audio/webm",
                    "mp3": "audio/mp3",
                    "m4a": "audio/m4a",
                }
                mime_type = mime_type_map.get(ext, "audio/wav")
            else:
                mime_type = "audio/wav"
        
        # Transcribe with Gemini using agent
        # The agent will handle WebM to WAV conversion if needed
        logger.info(f"Transcribing audio ({len(audio_data)} bytes, type: {mime_type})...")
        
        agent = await get_transcription_agent()
        agent_result = await agent.safe_execute({
            "audio_data": audio_data,
            "mime_type": mime_type,
        })
        
        if agent_result.success and agent_result.data:
            transcription_text = agent_result.data.get("text", "")
            return TranscriptionResponse(
                success=True,
                text=transcription_text
            )
        else:
            error_msg = agent_result.error or "Transcription failed"
            logger.error(f"Transcription agent error: {error_msg}")
            return TranscriptionResponse(
                success=False,
                error=error_msg
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription error")
        return TranscriptionResponse(
            success=False,
            error=str(e)
        )

