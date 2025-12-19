"""Intellibooks Studio - RAG Service API.

Provides endpoints for document upload, knowledge base queries, and RAG operations.
Uses the IntelliBooksPipeline with Ray, RabbitMQ, and Docker ChromaDB support.
"""

import logging
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global pipeline instance
pipeline = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize RAG pipeline on startup."""
    global pipeline

    logger.info("Initializing Intellibooks RAG Service...")

    try:
        from ..rag_pipeline import IntelliBooksPipeline, load_config

        config = load_config()
        pipeline = IntelliBooksPipeline(config)

        logger.info(f"RAG Service initialized successfully")
        logger.info(f"  ChromaDB: {config.chroma_host}:{config.chroma_port}")
        logger.info(f"  Ray enabled: {pipeline.ray_available}")
        logger.info(f"  RabbitMQ enabled: {pipeline.rabbitmq is not None}")

    except Exception as e:
        logger.error(f"Failed to initialize RAG service: {e}")
        import traceback
        traceback.print_exc()
        pipeline = None

    yield

    logger.info("Shutting down Intellibooks RAG Service")


app = FastAPI(
    title="Intellibooks Studio - RAG Service",
    description="Document Knowledge Base with RAG Pipeline powered by Ray, RabbitMQ, and ChromaDB",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Request/Response Models ============

class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    query: str
    chat_history: List[Dict[str, str]] = []
    top_k: Optional[int] = 5


class DeleteDocumentRequest(BaseModel):
    document_id: str


# ============ Health & Status Endpoints ============

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    try:
        if pipeline:
            stats = await pipeline.get_stats()
            return {
                "status": "healthy",
                "service": "intellibooks-rag",
                "version": "2.0.0",
                "documents_indexed": stats.get("total_chunks", 0),
                "chroma_connected": True,
                "ray_enabled": stats.get("ray_enabled", False),
                "rabbitmq_enabled": stats.get("rabbitmq_enabled", False),
            }
        return {
            "status": "degraded",
            "service": "intellibooks-rag",
            "error": "Pipeline not initialized",
        }
    except Exception as e:
        return {
            "status": "error",
            "service": "intellibooks-rag",
            "error": str(e),
        }


@app.get("/api/rag/stats")
async def get_stats():
    """Get RAG system statistics."""
    if pipeline is None:
        return {
            "status": "not_initialized",
            "total_chunks": 0,
        }

    try:
        stats = await pipeline.get_stats()
        return {
            "status": "ready",
            **stats,
        }
    except Exception as e:
        logger.exception(f"Error getting stats: {e}")
        return {
            "status": "error",
            "error": str(e),
        }


# ============ Document Upload Endpoints ============

@app.post("/api/rag/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_id: Optional[str] = Form(None),
):
    """Upload and process a document into the knowledge base."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        start_time = time.time()

        content = await file.read()
        filename = file.filename or "unknown"

        logger.info(f"Processing document: {filename} ({len(content)} bytes)")

        result = await pipeline.ingest_document(
            content=content,
            filename=filename,
            document_id=document_id,
        )

        return {
            "success": result.success,
            "document_id": result.document_id,
            "filename": result.filename,
            "chunks_created": result.chunks_created,
            "processing_time_ms": result.processing_time_ms,
            "error": result.error,
        }

    except Exception as e:
        logger.exception(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/upload-multiple")
async def upload_multiple_documents(
    files: List[UploadFile] = File(...),
):
    """Upload and process multiple documents in parallel (uses Ray if available)."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        start_time = time.time()

        # Read all files
        documents = []
        for file in files:
            content = await file.read()
            filename = file.filename or "unknown"
            documents.append((content, filename, None, None))

        logger.info(f"Processing {len(documents)} documents in parallel")

        # Process all documents in parallel (uses Ray if enabled)
        results = await pipeline.ingest_documents_parallel(documents)

        total_time = (time.time() - start_time) * 1000
        total_chunks = sum(r.chunks_created for r in results)
        successful = sum(1 for r in results if r.success)

        return {
            "success": True,
            "total_documents": len(documents),
            "successful_documents": successful,
            "total_chunks_created": total_chunks,
            "total_processing_time_ms": total_time,
            "ray_used": pipeline.ray_available,
            "results": [
                {
                    "document_id": r.document_id,
                    "filename": r.filename,
                    "success": r.success,
                    "chunks_created": r.chunks_created,
                    "processing_time_ms": r.processing_time_ms,
                    "error": r.error,
                }
                for r in results
            ],
        }

    except Exception as e:
        logger.exception(f"Error uploading documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Query Endpoints ============

@app.post("/api/rag/query")
async def query_knowledge_base(request: QueryRequest):
    """Query the knowledge base with RAG (semantic search + LLM generation)."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        response = await pipeline.query(
            query=request.query,
            top_k=request.top_k,
            filters=request.filters,
        )

        return {
            "answer": response.answer,
            "sources": response.sources,
            "query": response.query,
            "processing_time_ms": response.processing_time_ms,
            "confidence": response.confidence,
        }

    except Exception as e:
        logger.exception(f"Error querying knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/search")
async def search_documents(request: QueryRequest):
    """Semantic search without LLM generation."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        start_time = time.time()

        search_results = await pipeline.search(
            query=request.query,
            top_k=request.top_k,
            filters=request.filters,
        )

        return {
            "query": request.query,
            "results": [
                {
                    "id": r.id,
                    "content": r.content,
                    "score": r.score,
                    "metadata": r.metadata,
                }
                for r in search_results
            ],
            "total_results": len(search_results),
            "processing_time_ms": (time.time() - start_time) * 1000,
        }

    except Exception as e:
        logger.exception(f"Error searching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Management Endpoints ============

@app.delete("/api/rag/document/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and all its chunks."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        success = await pipeline.delete_document(document_id)
        return {
            "success": success,
            "document_id": document_id,
        }
    except Exception as e:
        logger.exception(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rag/clear")
async def clear_knowledge_base():
    """Clear all documents from the knowledge base."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        success = await pipeline.clear()
        return {
            "success": success,
            "message": "Knowledge base cleared" if success else "Failed to clear",
        }
    except Exception as e:
        logger.exception(f"Error clearing knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/documents")
async def list_documents():
    """List indexed document statistics."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        stats = await pipeline.get_stats()
        return {
            "total_chunks": stats.get("total_chunks", 0),
            "collection": stats.get("collection", "unknown"),
            "message": "Full document listing coming in future update",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
