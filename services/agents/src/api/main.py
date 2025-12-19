"""Agent Service API."""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import uuid
import aiofiles
import os
from pathlib import Path

from ..config import get_settings
from ..agents import (
    TranscriptionAgent,
    TranslationAgent,
    SummarizationAgent,
    IntentDetectionAgent,
    KeywordExtractionAgent,
)

# Global agent instances
transcription_agent: TranscriptionAgent = None
translation_agent: TranslationAgent = None
summarization_agent: SummarizationAgent = None
intent_agent: IntentDetectionAgent = None
keyword_agent: KeywordExtractionAgent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize agents on startup."""
    global transcription_agent, translation_agent, summarization_agent, intent_agent, keyword_agent

    settings = get_settings()

    # Ensure storage directories exist
    Path(settings.audio_storage_path).mkdir(parents=True, exist_ok=True)
    Path(settings.upload_storage_path).mkdir(parents=True, exist_ok=True)

    # Initialize agents
    transcription_agent = TranscriptionAgent()
    translation_agent = TranslationAgent()
    summarization_agent = SummarizationAgent()
    intent_agent = IntentDetectionAgent()
    keyword_agent = KeywordExtractionAgent()

    # Initialize all agents
    await transcription_agent.initialize()
    await translation_agent.initialize()
    await summarization_agent.initialize()
    await intent_agent.initialize()
    await keyword_agent.initialize()

    yield

    # Cleanup
    await transcription_agent.shutdown()
    await translation_agent.shutdown()
    await summarization_agent.shutdown()
    await intent_agent.shutdown()
    await keyword_agent.shutdown()


app = FastAPI(
    title="Agent Service",
    description="Audio Processing Agent Service for Audio Insight",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Models
class ProcessingRequest(BaseModel):
    audio_file_id: Optional[str] = None
    audio_file_path: Optional[str] = None
    tasks: List[str]
    options: Optional[Dict[str, Any]] = None


class TextAnalysisRequest(BaseModel):
    text: str
    tasks: List[str]
    options: Optional[Dict[str, Any]] = None


# Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "agent-service",
        "version": "1.0.0",
        "agents": {
            "transcription": transcription_agent.agent_id if transcription_agent else None,
            "translation": translation_agent.agent_id if translation_agent else None,
            "summarization": summarization_agent.agent_id if summarization_agent else None,
            "intent": intent_agent.agent_id if intent_agent else None,
            "keyword": keyword_agent.agent_id if keyword_agent else None,
        },
    }


@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file."""
    settings = get_settings()

    # Validate file type
    allowed_extensions = ["mp3", "wav", "flac", "m4a", "ogg", "aac", "webm"]
    ext = file.filename.split(".")[-1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}")

    # Generate file ID and path
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    file_path = Path(settings.upload_storage_path) / filename

    # Save file
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        if len(content) > settings.max_audio_size_mb * 1024 * 1024:
            raise HTTPException(400, f"File too large. Max size: {settings.max_audio_size_mb}MB")
        await f.write(content)

    return {
        "success": True,
        "file_id": file_id,
        "filename": file.filename,
        "size_bytes": len(content),
        "path": str(file_path),
    }


@app.post("/api/agents/process")
async def process_audio(request: ProcessingRequest):
    """Process audio with selected agents."""
    results = {}
    errors = []

    # Get audio path
    audio_path = request.audio_file_path
    if not audio_path and request.audio_file_id:
        settings = get_settings()
        # Try to find file by ID
        for ext in ["mp3", "wav", "flac", "m4a", "ogg", "aac", "webm"]:
            path = Path(settings.upload_storage_path) / f"{request.audio_file_id}.{ext}"
            if path.exists():
                audio_path = str(path)
                break

    if not audio_path:
        raise HTTPException(400, "No audio file specified or found")

    options = request.options or {}

    # Transcription (required for other tasks)
    transcription_text = None
    if "transcribe" in request.tasks or "full_pipeline" in request.tasks:
        result = await transcription_agent.safe_execute({
            "audio_file_path": audio_path,
            "language": options.get("source_language"),
            "include_timestamps": options.get("include_timestamps", False),
        })
        if result.success:
            results["transcription"] = result.data
            transcription_text = result.data["text"]
        else:
            errors.append({"task": "transcribe", "error": result.error})

    # For other tasks, we need the transcription
    if not transcription_text and any(t in request.tasks for t in ["translate", "summarize", "detect_intent", "extract_keywords", "full_pipeline"]):
        raise HTTPException(400, "Transcription failed or not requested. Other tasks require transcription.")

    # Translation
    if "translate" in request.tasks or "full_pipeline" in request.tasks:
        target_languages = options.get("target_languages", ["es"])
        result = await translation_agent.safe_execute({
            "text": transcription_text,
            "target_languages": target_languages,
        })
        if result.success:
            results["translations"] = result.data["translations"]
        else:
            errors.append({"task": "translate", "error": result.error})

    # Summarization
    if "summarize" in request.tasks or "full_pipeline" in request.tasks:
        result = await summarization_agent.safe_execute({
            "text": transcription_text,
            "summary_type": options.get("summary_type", "general"),
        })
        if result.success:
            results["summary"] = result.data
        else:
            errors.append({"task": "summarize", "error": result.error})

    # Intent Detection
    if "detect_intent" in request.tasks or "full_pipeline" in request.tasks:
        result = await intent_agent.safe_execute({
            "text": transcription_text,
        })
        if result.success:
            results["intent"] = result.data
        else:
            errors.append({"task": "detect_intent", "error": result.error})

    # Keyword Extraction
    if "extract_keywords" in request.tasks or "full_pipeline" in request.tasks:
        result = await keyword_agent.safe_execute({
            "text": transcription_text,
            "max_keywords": options.get("max_keywords", 10),
        })
        if result.success:
            results["keywords"] = result.data
        else:
            errors.append({"task": "extract_keywords", "error": result.error})

    return {
        "success": len(errors) == 0,
        "results": results,
        "errors": errors if errors else None,
    }


@app.post("/api/agents/analyze-text")
async def analyze_text(request: TextAnalysisRequest):
    """Analyze text directly (without audio)."""
    results = {}
    errors = []
    options = request.options or {}

    if "translate" in request.tasks:
        result = await translation_agent.safe_execute({
            "text": request.text,
            "target_languages": options.get("target_languages", ["es"]),
        })
        if result.success:
            results["translations"] = result.data["translations"]
        else:
            errors.append({"task": "translate", "error": result.error})

    if "summarize" in request.tasks:
        result = await summarization_agent.safe_execute({
            "text": request.text,
            "summary_type": options.get("summary_type", "general"),
        })
        if result.success:
            results["summary"] = result.data
        else:
            errors.append({"task": "summarize", "error": result.error})

    if "detect_intent" in request.tasks:
        result = await intent_agent.safe_execute({"text": request.text})
        if result.success:
            results["intent"] = result.data
        else:
            errors.append({"task": "detect_intent", "error": result.error})

    if "extract_keywords" in request.tasks:
        result = await keyword_agent.safe_execute({
            "text": request.text,
            "max_keywords": options.get("max_keywords", 10),
        })
        if result.success:
            results["keywords"] = result.data
        else:
            errors.append({"task": "extract_keywords", "error": result.error})

    return {
        "success": len(errors) == 0,
        "results": results,
        "errors": errors if errors else None,
    }


@app.get("/api/agents/registry")
async def list_agents():
    """List all registered agents."""
    agents = []

    for agent in [transcription_agent, translation_agent, summarization_agent, intent_agent, keyword_agent]:
        if agent:
            agents.append(agent.to_registry_entry())

    return {"agents": agents}


@app.get("/api/agents/{agent_id}/identity")
async def get_agent_identity(agent_id: str):
    """Get an agent's identity card."""
    for agent in [transcription_agent, translation_agent, summarization_agent, intent_agent, keyword_agent]:
        if agent and agent.agent_id == agent_id:
            return agent.identity.model_dump()

    raise HTTPException(404, f"Agent not found: {agent_id}")


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)
