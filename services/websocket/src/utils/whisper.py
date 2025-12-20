"""Whisper transcription utilities using whisper.cpp."""

import logging
import os
import subprocess
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
import shutil

logger = logging.getLogger(__name__)


class WhisperError(Exception):
    """Custom exception for Whisper errors."""
    pass


def find_whisper_binary(config_path: Optional[str] = None) -> Optional[str]:
    """Find whisper.cpp binary in common locations or use config."""
    # Use config path if provided
    if config_path and os.path.exists(config_path) and os.access(config_path, os.X_OK):
        return config_path
    
    # Check common paths
    common_paths = [
        "/home/jipl/whisper.cpp/build/bin/whisper-cli",
        "/usr/local/bin/whisper-cli",
        "/usr/bin/whisper-cli",
        "whisper-cli",  # In PATH
    ]
    
    for path in common_paths:
        if path == "whisper-cli":
            # Check if it's in PATH
            if shutil.which(path):
                return path
        elif os.path.exists(path) and os.access(path, os.X_OK):
            return path
    
    return None


def find_whisper_model(config_path: Optional[str] = None) -> Optional[str]:
    """Find whisper model in common locations or use config."""
    # Use config path if provided
    if config_path and os.path.exists(config_path):
        return config_path
    
    # Check common paths
    common_paths = [
        "/home/jipl/whisper.cpp/models/ggml-small.bin",
        "/home/jipl/whisper.cpp/models/ggml-base.bin",
        "/home/jipl/whisper.cpp/models/ggml-tiny.bin",
    ]
    
    for path in common_paths:
        if os.path.exists(path):
            return path
    
    return None


def transcribe_with_whisper(
    audio_path: str,
    whisper_path: Optional[str] = None,
    model_path: Optional[str] = None,
    output_format: str = "json",  # "json", "txt", or "both"
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Transcribe audio using whisper.cpp.
    
    Args:
        audio_path: Path to audio file
        whisper_path: Path to whisper-cli binary (auto-detected if None)
        model_path: Path to whisper model (auto-detected if None)
        output_format: "json", "txt", or "both"
        language: Optional language code (e.g., "en")
    
    Returns:
        Dictionary with transcription results
    """
    # Auto-detect paths if not provided
    if not whisper_path:
        whisper_path = find_whisper_binary()
        if not whisper_path:
            raise WhisperError("Whisper binary not found. Please install whisper.cpp or provide whisper_path.")
    
    if not model_path:
        model_path = find_whisper_model()
        if not model_path:
            raise WhisperError("Whisper model not found. Please provide model_path.")
    
    if not os.path.exists(audio_path):
        raise WhisperError(f"Audio file not found: {audio_path}")
    
    if not os.path.exists(whisper_path):
        raise WhisperError(f"Whisper binary not found: {whisper_path}")
    
    if not os.path.exists(model_path):
        raise WhisperError(f"Whisper model not found: {model_path}")
    
    result: Dict[str, Any] = {
        "plain_text": "",
        "json_with_timestamps": "",
        "whisper_model_used": os.path.basename(model_path),
    }
    
    try:
        # Get plain text transcription
        if output_format in ["txt", "both"]:
            logger.info("Running Whisper plain text transcription...")
            txt_cmd = [
                whisper_path,
                "-m", model_path,
                "-f", audio_path,
                "-otxt",  # Output text
                "-nt",    # No timestamps
                "-pp",    # Print progress
            ]
            
            if language:
                txt_cmd.extend(["-l", language])
            
            txt_result = subprocess.run(
                txt_cmd,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout
            )
            
            if txt_result.returncode == 0:
                result["plain_text"] = txt_result.stdout.strip()
                logger.info(f"Plain text transcription completed: {len(result['plain_text'])} chars")
            else:
                logger.warning(f"Plain text transcription failed: {txt_result.stderr}")
        
        # Get JSON transcription with timestamps
        if output_format in ["json", "both"]:
            logger.info("Running Whisper JSON transcription...")
            json_cmd = [
                whisper_path,
                "-m", model_path,
                "-f", audio_path,
                "-oj",   # Output JSON
                "-pp",   # Print progress
            ]
            
            if language:
                json_cmd.extend(["-l", language])
            
            json_result = subprocess.run(
                json_cmd,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout
            )
            
            if json_result.returncode == 0:
                result["json_with_timestamps"] = json_result.stdout.strip()
                logger.info(f"JSON transcription completed: {len(result['json_with_timestamps'])} chars")
            else:
                logger.warning(f"JSON transcription failed: {json_result.stderr}")
        
        return result
        
    except subprocess.TimeoutExpired:
        raise WhisperError("Whisper transcription timed out")
    except Exception as e:
        logger.exception(f"Whisper transcription error: {e}")
        raise WhisperError(f"Whisper transcription failed: {str(e)}")


def transcribe_chunk(
    audio_data: bytes,
    whisper_path: Optional[str] = None,
    model_path: Optional[str] = None,
) -> str:
    """
    Transcribe a single audio chunk quickly (plain text only).
    
    Args:
        audio_data: Audio file bytes
        whisper_path: Path to whisper-cli binary
        model_path: Path to whisper model
    
    Returns:
        Transcribed text
    """
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
        tmp_path = tmp_file.name
        tmp_file.write(audio_data)
    
    try:
        result = transcribe_with_whisper(
            tmp_path,
            whisper_path=whisper_path,
            model_path=model_path,
            output_format="txt",
        )
        return result.get("plain_text", "")
    finally:
        # Cleanup
        try:
            os.unlink(tmp_path)
        except:
            pass

