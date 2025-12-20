"""Background processing for meeting sessions."""

import asyncio
import logging
import os
from typing import Dict, Any, Optional
import arrow
from ..config import get_settings
from ..utils.redis_client import (
    get_session,
    update_session_field,
    get_chunks_from_queue,
    clear_chunk_queue,
    save_processing_state,
    get_processing_state,
    save_metadata,
)
from ..utils.whisper import transcribe_chunk, find_whisper_binary, find_whisper_model
from ..connection_manager import manager

logger = logging.getLogger(__name__)
settings = get_settings()

# Background task registry
_background_tasks: Dict[str, asyncio.Task] = {}


async def process_meeting_chunks(session_id: str) -> None:
    """
    Background task to process all chunks for a meeting session.
    
    This runs even if the client disconnects or meeting ends abruptly.
    """
    logger.info(f"Starting background processing for session: {session_id}")
    
    try:
        # Update session status to processing
        await update_session_field(session_id, "status", "processing")
        await save_processing_state(session_id, {
            "status": "processing",
            "started_at": arrow.utcnow().isoformat(),
            "chunks_processed": 0,
            "total_chunks": 0,
        })
        
        # Get all chunks from queue
        chunks = await get_chunks_from_queue(session_id)
        logger.info(f"Found {len(chunks)} chunks to process for session {session_id}")
        
        if not chunks:
            logger.warning(f"No chunks found for session {session_id}")
            await update_session_field(session_id, "status", "completed")
            return
        
        # Get session data
        session = await get_session(session_id)
        if not session:
            logger.error(f"Session {session_id} not found")
            return
        
        # Process chunks
        whisper_path = find_whisper_binary(settings.whisper_path)
        model_path = find_whisper_model(settings.whisper_model_path)
        
        if not whisper_path or not model_path:
            logger.error("Whisper not available for background processing")
            await update_session_field(session_id, "status", "failed")
            return
        
        transcript_parts = []
        chunks_processed = 0
        
        for chunk_data in chunks:
            try:
                chunk_index = chunk_data.get("index", 0)
                audio_data_list = chunk_data.get("audio_data")
                
                if not audio_data_list:
                    logger.warning(f"Chunk {chunk_index} has no audio data")
                    continue
                
                # Convert list back to bytes
                audio_data = bytes(audio_data_list)
                
                # Save to temp file for Whisper
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                    tmp_path = tmp_file.name
                    tmp_file.write(audio_data)
                
                try:
                    # Transcribe chunk
                    transcript_text = transcribe_chunk(
                        audio_data,
                        whisper_path=whisper_path,
                        model_path=model_path,
                    )
                    
                    if transcript_text:
                        transcript_parts.append(transcript_text)
                    
                    chunks_processed += 1
                    
                    # Update processing state
                    await save_processing_state(session_id, {
                        "status": "processing",
                        "chunks_processed": chunks_processed,
                        "total_chunks": len(chunks),
                    })
                    
                    logger.info(f"Processed chunk {chunk_index}/{len(chunks)} for session {session_id}")
                finally:
                    # Cleanup temp file
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
                
            except Exception as e:
                logger.error(f"Error processing chunk {chunk_index}: {e}")
                continue
        
        # Combine transcript
        final_transcript = " ".join(transcript_parts)
        
        # Update session with final transcript
        await update_session_field(session_id, "transcript", final_transcript)
        await update_session_field(session_id, "chunks_processed", chunks_processed)
        await update_session_field(session_id, "total_chunks", len(chunks))
        
        # Clear chunk queue
        await clear_chunk_queue(session_id)
        
        # Run post-processing
        await run_post_processing(session_id, final_transcript)
        
        # Mark as completed
        await update_session_field(session_id, "status", "completed")
        await update_session_field(session_id, "completed_at", arrow.utcnow().isoformat())
        
        logger.info(f"Background processing completed for session {session_id}")
        
        # Log completion (TODO: Replace with DB storage)
        logger.info(f"MEETING COMPLETED - Session: {session_id}, "
                   f"Duration: {session.get('duration_seconds', 'N/A')}s, "
                   f"Chunks: {chunks_processed}/{len(chunks)}, "
                   f"Transcript length: {len(final_transcript)} chars")
        
    except Exception as e:
        logger.exception(f"Background processing failed for session {session_id}")
        await update_session_field(session_id, "status", "failed")
        await save_processing_state(session_id, {
            "status": "failed",
            "error": str(e),
        })


async def run_post_processing(session_id: str, transcript: str) -> None:
    """
    Run post-processing tasks: summarization, keywords, agenda, mood analysis, metrics.
    """
    logger.info(f"Starting post-processing for session {session_id}")
    
    try:
        metadata = {
            "transcript_length": len(transcript),
            "word_count": len(transcript.split()),
            "processed_at": arrow.utcnow().isoformat(),
        }
        
        # Import agents (lazy import to avoid circular dependencies)
        try:
            from services.agents.src.agents.summarization_agent import SummarizationAgent
            from services.agents.src.agents.keyword_agent import KeywordExtractionAgent
        except ImportError:
            try:
                import sys
                from pathlib import Path
                project_root = Path(__file__).parent.parent.parent.parent.parent
                if str(project_root) not in sys.path:
                    sys.path.insert(0, str(project_root))
                from services.agents.src.agents.summarization_agent import SummarizationAgent
                from services.agents.src.agents.keyword_agent import KeywordExtractionAgent
            except ImportError as e:
                logger.error(f"Failed to import agents: {e}")
                await save_metadata(session_id, metadata)
                return
        
        # Run summarization
        try:
            summary_agent = SummarizationAgent()
            await summary_agent.initialize()
            summary_result = await summary_agent.safe_execute({"text": transcript})
            if summary_result.success and summary_result.data:
                metadata["summary"] = summary_result.data.get("summary")
                metadata["key_points"] = summary_result.data.get("key_points", [])
                metadata["main_topics"] = summary_result.data.get("main_topics", [])
                metadata["action_items"] = summary_result.data.get("action_items", [])
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
        
        # Run keyword extraction
        try:
            keyword_agent = KeywordExtractionAgent()
            await keyword_agent.initialize()
            keyword_result = await keyword_agent.safe_execute({"text": transcript})
            if keyword_result.success and keyword_result.data:
                metadata["keywords"] = keyword_result.data.get("keywords", [])
                metadata["main_theme"] = keyword_result.data.get("main_theme")
                metadata["domain"] = keyword_result.data.get("domain")
        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
        
        # Run mood analysis (text-based with LLM)
        try:
            from services.agents.src.agents.mood_agent import MoodAnalysisAgent
            mood_agent = MoodAnalysisAgent()
            await mood_agent.initialize()
            mood_result = await mood_agent.safe_execute({"text": transcript})
            if mood_result.success and mood_result.data:
                metadata["mood"] = mood_result.data
        except Exception as e:
            logger.error(f"Mood analysis failed: {e}")
        
        # Extract meeting agenda
        try:
            from services.agents.src.agents.agenda_agent import AgendaExtractionAgent
            agenda_agent = AgendaExtractionAgent()
            await agenda_agent.initialize()
            agenda_result = await agenda_agent.safe_execute({"text": transcript})
            if agenda_result.success and agenda_result.data:
                metadata["agenda"] = agenda_result.data
        except Exception as e:
            logger.error(f"Agenda extraction failed: {e}")
        
        # Calculate metrics
        metrics = calculate_meeting_metrics(transcript)
        metadata["metrics"] = metrics
        
        # Save metadata
        await save_metadata(session_id, metadata)
        logger.info(f"Post-processing completed for session {session_id}")
        
    except Exception as e:
        logger.exception(f"Post-processing failed for session {session_id}")




def calculate_meeting_metrics(transcript: str) -> Dict[str, Any]:
    """Calculate meeting metrics from transcript."""
    words = transcript.split()
    word_count = len(words)
    char_count = len(transcript)
    
    # Estimate speaking rate (words per minute) - assuming average 150 WPM
    # This is a rough estimate, actual rate would need audio duration
    estimated_duration_minutes = word_count / 150 if word_count > 0 else 0
    
    # Count sentences
    sentence_count = transcript.count('.') + transcript.count('!') + transcript.count('?')
    
    # Count questions (engagement indicator)
    question_count = transcript.count('?')
    
    # Average words per sentence
    avg_words_per_sentence = word_count / sentence_count if sentence_count > 0 else 0
    
    return {
        "word_count": word_count,
        "character_count": char_count,
        "sentence_count": sentence_count,
        "question_count": question_count,
        "estimated_duration_minutes": round(estimated_duration_minutes, 2),
        "average_words_per_sentence": round(avg_words_per_sentence, 2),
        "engagement_score": min(question_count / max(sentence_count, 1) * 10, 10),  # 0-10 scale
    }


async def start_background_processing(session_id: str) -> None:
    """Start background processing task for a session."""
    if session_id in _background_tasks:
        logger.warning(f"Background processing already running for session {session_id}")
        return
    
    task = asyncio.create_task(process_meeting_chunks(session_id))
    _background_tasks[session_id] = task
    
    # Clean up task when done
    def cleanup_task(task_id: str):
        async def _cleanup():
            try:
                await task
            finally:
                _background_tasks.pop(task_id, None)
        return _cleanup()
    
    asyncio.create_task(cleanup_task(session_id))
    logger.info(f"Started background processing task for session {session_id}")


async def check_abrupt_endings() -> None:
    """
    Check for sessions that ended abruptly (no activity for 60 seconds).
    This should be called periodically.
    """
    try:
        from ..utils.redis_client import get_redis_client
        redis = await get_redis_client()
        
        # Get all session keys
        session_keys = await redis.keys("meeting:session:*")
        
        for key in session_keys:
            session_id = key.replace("meeting:session:", "")
            session = await get_session(session_id)
            
            if session and session.get("status") == "recording":
                last_activity_str = session.get("last_activity")
                if last_activity_str:
                    try:
                        last_activity = arrow.get(last_activity_str)
                        time_since_activity = (arrow.utcnow() - last_activity).total_seconds()
                        
                        if time_since_activity > 60:  # 60 seconds timeout
                            logger.info(f"Detected abrupt end for session {session_id} (no activity for {time_since_activity:.0f}s)")
                            await update_session_field(session_id, "status", "processing")
                            await update_session_field(session_id, "ended_abruptly", True)
                            await update_session_field(session_id, "ended_at", arrow.utcnow().isoformat())
                            
                            # Start background processing
                            await start_background_processing(session_id)
                    except Exception as e:
                        logger.error(f"Error checking session {session_id}: {e}")
    except Exception as e:
        logger.error(f"Error in check_abrupt_endings: {e}")

