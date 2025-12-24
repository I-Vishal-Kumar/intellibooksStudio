"""Meeting recording routes with live transcription and Redis-backed storage."""

import logging
import tempfile
import os
from pathlib import Path
from typing import Dict, Any, Optional
import arrow
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from ...config import get_settings
from ...connection_manager import manager
from ...utils.whisper import (
    transcribe_chunk,
    WhisperError,
    find_whisper_binary,
    find_whisper_model,
)
from ...utils.diarization import run_diarization, DiarizationError
from ...utils.redis_client import (
    save_session,
    get_session,
    update_session_field,
    add_chunk_to_queue,
    get_processing_state,
    get_metadata,
)
from ...utils.background_processor import start_background_processing

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/meetings", tags=["meetings"])

settings = get_settings()

# Track last activity for abrupt end detection
_last_activity: Dict[str, float] = {}
ABRUPT_END_TIMEOUT = 60  # 60 seconds


async def broadcast_transcript_update(
    session_id: str,
    transcript: str,
    chunks_processed: int,
    total_chunks: int,
):
    """
    Broadcast transcript update to all WebSocket connections in the session.
    
    Args:
        session_id: Meeting session ID
        transcript: Current transcript text
        chunks_processed: Number of chunks processed
        total_chunks: Total number of chunks
    """
    try:
        message = {
            "type": "transcript_update",
            "event": "transcript_updated",
            "session_id": session_id,
            "content": transcript,
            "metadata": {
                "chunks_processed": chunks_processed,
                "total_chunks": total_chunks,
                "transcript_length": len(transcript),
            },
            "timestamp": arrow.utcnow().isoformat(),
        }
        
        await manager.broadcast_to_session(message, session_id)
        logger.debug(f"Broadcasted transcript update for session {session_id}")
    except Exception as e:
        logger.error(f"Failed to broadcast transcript update: {e}")


async def check_and_handle_abrupt_end(session_id: str) -> None:
    """Check if session ended abruptly and trigger background processing."""
    import time
    
    current_time = time.time()
    last_activity = _last_activity.get(session_id, 0)
    
    if last_activity > 0 and (current_time - last_activity) > ABRUPT_END_TIMEOUT:
        session = await get_session(session_id)
        if session and session.get("status") == "recording":
            logger.info(f"Session {session_id} ended abruptly (no activity for {ABRUPT_END_TIMEOUT}s)")
            await update_session_field(session_id, "status", "processing")
            await update_session_field(session_id, "ended_abruptly", True)
            await update_session_field(session_id, "ended_at", arrow.utcnow().isoformat())
            
            # Start background processing
            await start_background_processing(session_id)
            
            # Remove from activity tracking
            _last_activity.pop(session_id, None)


class MeetingSessionResponse(BaseModel):
    """Response model for meeting session."""
    session_id: str
    status: str
    created_at: str


class TranscriptResponse(BaseModel):
    """Response model for transcript."""
    transcript: str
    chunks_processed: int
    total_chunks: int


class MeetingStatusResponse(BaseModel):
    """Response model for meeting status."""
    session_id: str
    status: str
    chunks_processed: int
    total_chunks: int
    processing_state: Optional[Dict[str, Any]] = None


@router.post("/start", response_model=MeetingSessionResponse)
async def start_meeting_session():
    """
    Start a new meeting recording session.
    
    Returns:
        Session ID and status
    """
    try:
        import time
        
        session_id = str(uuid4())
        
        session_data = {
            "session_id": session_id,
            "status": "recording",
            "created_at": arrow.utcnow().isoformat(),
            "transcript": "",
            "chunks_processed": 0,
            "total_chunks": 0,
            "last_activity": arrow.utcnow().isoformat(),
        }
        
        await save_session(session_id, session_data)
        _last_activity[session_id] = time.time()
        
        logger.info(f"Started meeting session: {session_id}")
        
        return MeetingSessionResponse(
            session_id=session_id,
            status="recording",
            created_at=session_data["created_at"],
        )
    except Exception as e:
        logger.exception("Failed to start meeting session")
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@router.post("/{session_id}/chunk")
async def upload_audio_chunk(
    session_id: str,
    audio_chunk: UploadFile = File(...),
    chunk_index: str = Form(...),
):
    """
    Upload and transcribe an audio chunk.
    Chunks are stored in Redis queue for background processing.
    
    Args:
        session_id: Meeting session ID
        audio_chunk: Audio chunk file
        chunk_index: Chunk index number
    
    Returns:
        Processing status
    """
    import time
    
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not in recording state")
    
    try:
        # Update last activity
        _last_activity[session_id] = time.time()
        await update_session_field(session_id, "last_activity", arrow.utcnow().isoformat())
        
        # Read audio chunk
        audio_data = await audio_chunk.read()
        
        if not audio_data:
            raise HTTPException(status_code=400, detail="Empty audio chunk")
        
        chunk_idx = int(chunk_index)
        logger.info(f"Received chunk {chunk_idx} for session {session_id} ({len(audio_data)} bytes)")
        
        # Add chunk to Redis queue (for background processing)
        chunk_data = {
            "index": chunk_idx,
            "audio_data": list(audio_data),  # Convert bytes to list for JSON serialization
            "received_at": arrow.utcnow().isoformat(),
        }
        await add_chunk_to_queue(session_id, chunk_data)
        
        # Update total chunks count
        current_total = session.get("total_chunks", 0)
        await update_session_field(session_id, "total_chunks", max(current_total, chunk_idx + 1))
        
        # Try to transcribe immediately for live updates (non-blocking)
        try:
            whisper_path = find_whisper_binary(settings.whisper_path)
            model_path = find_whisper_model(settings.whisper_model_path)
            
            if whisper_path and model_path:
                # Transcribe for live display
                transcript_text = transcribe_chunk(
                    audio_data,
                    whisper_path=whisper_path,
                    model_path=model_path,
                )
                
                # Update session transcript
                if transcript_text:
                    current_transcript = session.get("transcript", "")
                    new_transcript = current_transcript + " " + transcript_text if current_transcript else transcript_text
                    await update_session_field(session_id, "transcript", new_transcript)
                    
                    # Update chunks processed count
                    chunks_processed = session.get("chunks_processed", 0) + 1
                    await update_session_field(session_id, "chunks_processed", chunks_processed)
                    
                    # Broadcast transcript update
                    updated_session = await get_session(session_id)
                    await broadcast_transcript_update(
                        session_id,
                        updated_session.get("transcript", ""),
                        chunks_processed,
                        updated_session.get("total_chunks", 0),
                    )
                    
                    logger.info(f"Chunk {chunk_idx} transcribed live: {len(transcript_text)} chars")
        except Exception as e:
            logger.warning(f"Live transcription failed for chunk {chunk_idx}, will process in background: {e}")
        
        return {
            "success": True,
            "chunk_index": chunk_idx,
            "queued": True,
            "message": "Chunk queued for processing",
        }
    
    except WhisperError as e:
        logger.error(f"Whisper error for chunk {chunk_index}: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    except Exception as e:
        logger.exception(f"Error processing chunk {chunk_index}")
        raise HTTPException(status_code=500, detail=f"Failed to process chunk: {str(e)}")


@router.get("/{session_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(session_id: str):
    """
    Get the current transcript for a meeting session.
    
    Args:
        session_id: Meeting session ID
    
    Returns:
        Current transcript and progress
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return TranscriptResponse(
        transcript=session.get("transcript", ""),
        chunks_processed=session.get("chunks_processed", 0),
        total_chunks=session.get("total_chunks", 0),
    )


@router.get("/{session_id}/status", response_model=MeetingStatusResponse)
async def get_meeting_status(session_id: str):
    """
    Get meeting session status and processing state.
    
    Args:
        session_id: Meeting session ID
    
    Returns:
        Meeting status and processing information
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    processing_state = await get_processing_state(session_id)
    
    return MeetingStatusResponse(
        session_id=session_id,
        status=session.get("status", "unknown"),
        chunks_processed=session.get("chunks_processed", 0),
        total_chunks=session.get("total_chunks", 0),
        processing_state=processing_state,
    )


@router.get("/{session_id}/metadata")
async def get_meeting_metadata(session_id: str):
    """
    Get meeting metadata (summary, keywords, mood, agenda, metrics).
    
    Args:
        session_id: Meeting session ID
    
    Returns:
        Meeting metadata
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Meeting not yet completed")
    
    metadata = await get_metadata(session_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Metadata not yet available")
    
    return metadata


@router.post("/{session_id}/stop")
async def stop_meeting_session(session_id: str):
    """
    Stop a meeting recording session and trigger background processing.
    
    Args:
        session_id: Meeting session ID
    
    Returns:
        Final meeting data
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["status"] != "recording":
        raise HTTPException(status_code=400, detail="Session is not in recording state")
    
    try:
        # Mark session as processing (background processing will complete it)
        await update_session_field(session_id, "status", "processing")
        await update_session_field(session_id, "stopped_at", arrow.utcnow().isoformat())
        await update_session_field(session_id, "ended_abruptly", False)
        
        # Remove from activity tracking
        _last_activity.pop(session_id, None)
        
        logger.info(f"Stopped meeting session: {session_id}, starting background processing")
        
        # Start background processing
        await start_background_processing(session_id)
        
        # Broadcast session stopped event
        await manager.broadcast_to_session({
            "type": "system",
            "event": "meeting_stopped",
            "session_id": session_id,
            "content": "Meeting recording stopped, processing in background",
            "metadata": {
                "status": "processing",
            },
            "timestamp": arrow.utcnow().isoformat(),
        }, session_id)
        
        return {
            "success": True,
            "session_id": session_id,
            "status": "processing",
            "message": "Meeting stopped, processing in background",
        }
    
    except Exception as e:
        logger.exception(f"Error stopping session {session_id}")
        raise HTTPException(status_code=500, detail=f"Failed to stop session: {str(e)}")


@router.get("/{session_id}")
async def get_meeting_session(session_id: str):
    """
    Get meeting session details.
    
    Args:
        session_id: Meeting session ID
    
    Returns:
        Session details
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session
