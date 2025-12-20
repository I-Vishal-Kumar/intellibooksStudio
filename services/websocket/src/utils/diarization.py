"""Speaker Diarization utilities using pyannote.audio."""

import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional
import json

logger = logging.getLogger(__name__)


class DiarizationError(Exception):
    """Custom exception for diarization errors."""
    pass


def run_diarization(audio_path: str, hf_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Run speaker diarization on an audio file using pyannote.audio.
    
    Args:
        audio_path: Path to the audio file
        hf_token: Optional Hugging Face token for gated models
    
    Returns:
        List of speaker segments with start, end, and speaker labels
    """
    try:
        from pyannote.audio import Pipeline
        import torch
        import torchaudio
    except ImportError as e:
        logger.error(f"Diarization dependencies not available: {e}")
        raise DiarizationError(
            "Diarization dependencies not installed. Install pyannote.audio, torch, and torchaudio."
        )
    
    if not os.path.exists(audio_path):
        raise DiarizationError(f"Audio file not found: {audio_path}")
    
    try:
        # Get token from environment if not provided
        token = hf_token or os.getenv("HF_TOKEN")
        
        if not token:
            logger.warning("No HF_TOKEN found. Diarization may fail for gated models.")
        
        # Load pipeline
        logger.info("Loading pyannote speaker diarization pipeline...")
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=token
        )
        
        # Use GPU if available
        if torch.cuda.is_available():
            pipeline = pipeline.to(torch.device("cuda"))
            logger.info("Using GPU for diarization")
        else:
            logger.info("Using CPU for diarization")
        
        # Load and preprocess audio
        logger.info(f"Loading audio file: {audio_path}")
        waveform, sample_rate = torchaudio.load(audio_path)
        
        # Resample to 16kHz if needed (pyannote expects 16kHz)
        if sample_rate != 16000:
            logger.info(f"Resampling from {sample_rate}Hz to 16000Hz")
            resampler = torchaudio.transforms.Resample(
                orig_freq=sample_rate,
                new_freq=16000
            )
            waveform = resampler(waveform)
            sample_rate = 16000
        
        # Mix to mono if needed
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        
        # Run diarization
        logger.info("Running speaker diarization...")
        diarization = pipeline({
            "waveform": waveform,
            "sample_rate": sample_rate
        })
        
        # Format output
        segments = []
        annotation = diarization
        
        # Handle different pyannote versions
        if hasattr(diarization, 'speaker_diarization'):
            annotation = diarization.speaker_diarization
        
        for turn, _, speaker in annotation.itertracks(yield_label=True):
            segments.append({
                "start": float(turn.start),
                "end": float(turn.end),
                "speaker": speaker
            })
        
        logger.info(f"Diarization completed: {len(segments)} segments found")
        return segments
        
    except Exception as e:
        logger.exception(f"Diarization failed: {e}")
        raise DiarizationError(f"Diarization failed: {str(e)}")


def run_diarization_subprocess(audio_path: str, hf_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Run diarization using subprocess (alternative method).
    
    This is useful if pyannote.audio is not directly importable
    or if you want to isolate the diarization process.
    
    Args:
        audio_path: Path to the audio file
        hf_token: Optional Hugging Face token
    
    Returns:
        List of speaker segments
    """
    # Get the diarize.py script path
    script_path = Path(__file__).parent.parent / "diarize.py"
    
    if not script_path.exists():
        raise DiarizationError("diarize.py script not found")
    
    try:
        env = os.environ.copy()
        if hf_token:
            env["HF_TOKEN"] = hf_token
        
        result = subprocess.run(
            ["python", str(script_path), audio_path],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            env=env
        )
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout
            raise DiarizationError(f"Diarization subprocess failed: {error_msg}")
        
        # Parse JSON output
        segments = json.loads(result.stdout)
        return segments
        
    except subprocess.TimeoutExpired:
        raise DiarizationError("Diarization timed out")
    except json.JSONDecodeError as e:
        raise DiarizationError(f"Failed to parse diarization output: {e}")
    except Exception as e:
        raise DiarizationError(f"Diarization subprocess error: {str(e)}")

