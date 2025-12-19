"""RAG Service API."""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from ..config import get_settings
from ..vector_store import ChromaVectorStore
from ..indexer import DocumentIndexer
from ..retriever import SemanticRetriever
from ..query_engine import RAGQueryEngine

# Global instances
vector_store: ChromaVectorStore = None
indexer: DocumentIndexer = None
retriever: SemanticRetriever = None
query_engine: RAGQueryEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global vector_store, indexer, retriever, query_engine

    settings = get_settings()

    # Initialize vector store
    vector_store = ChromaVectorStore(
        host=settings.chroma_host,
        port=settings.chroma_port,
        collection_name=settings.chroma_collection,
        embedding_model=settings.embedding_model,
    )

    # Initialize components
    indexer = DocumentIndexer(
        vector_store=vector_store,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )

    retriever = SemanticRetriever(
        vector_store=vector_store,
        default_top_k=settings.top_k_results,
    )

    query_engine = RAGQueryEngine(
        retriever=retriever,
        llm_provider=settings.default_llm_provider,
    )

    yield

    # Cleanup if needed


app = FastAPI(
    title="RAG Service",
    description="RAG Pipeline Service for Audio Insight",
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


# Request/Response Models
class IndexTranscriptRequest(BaseModel):
    transcript_id: str
    text: str
    metadata: Optional[Dict[str, Any]] = None


class IndexSummaryRequest(BaseModel):
    summary_id: str
    transcript_id: str
    summary_text: str
    key_points: List[str]
    metadata: Optional[Dict[str, Any]] = None


class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None


class ChatQueryRequest(BaseModel):
    query: str
    chat_history: List[Dict[str, str]] = []
    top_k: Optional[int] = 5


class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None
    min_score: Optional[float] = 0.5


# Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    count = await vector_store.count() if vector_store else 0
    return {
        "status": "healthy",
        "service": "rag-service",
        "version": "1.0.0",
        "documents_indexed": count,
    }


@app.post("/api/rag/index")
async def index_transcript(request: IndexTranscriptRequest):
    """Index a transcript for RAG retrieval."""
    try:
        chunk_ids = await indexer.index_transcript(
            transcript_id=request.transcript_id,
            text=request.text,
            metadata=request.metadata,
        )
        return {
            "success": True,
            "transcript_id": request.transcript_id,
            "chunks_created": len(chunk_ids),
            "chunk_ids": chunk_ids,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/index-summary")
async def index_summary(request: IndexSummaryRequest):
    """Index a summary with key points."""
    try:
        chunk_ids = await indexer.index_summary(
            summary_id=request.summary_id,
            transcript_id=request.transcript_id,
            summary_text=request.summary_text,
            key_points=request.key_points,
            metadata=request.metadata,
        )
        return {
            "success": True,
            "summary_id": request.summary_id,
            "chunks_created": len(chunk_ids),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rag/index/{transcript_id}")
async def delete_transcript_index(transcript_id: str):
    """Delete indexed chunks for a transcript."""
    try:
        success = await indexer.delete_transcript(transcript_id)
        return {"success": success, "transcript_id": transcript_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/query")
async def query_rag(request: QueryRequest):
    """Query the RAG system."""
    try:
        response = await query_engine.query(
            question=request.query,
            top_k=request.top_k,
            filters=request.filters,
        )
        return response.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/chat")
async def chat_query(request: ChatQueryRequest):
    """Query with chat history context."""
    try:
        response = await query_engine.query_with_chat_history(
            question=request.query,
            chat_history=request.chat_history,
            top_k=request.top_k,
        )
        return response.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/search")
async def search(request: SearchRequest):
    """Semantic search without LLM generation."""
    try:
        result = await retriever.retrieve(
            query=request.query,
            top_k=request.top_k,
            filters=request.filters,
            min_score=request.min_score,
        )
        return {
            "query": result.query,
            "results": [
                {
                    "id": chunk.id,
                    "content": chunk.content,
                    "score": chunk.score,
                    "metadata": chunk.metadata,
                }
                for chunk in result.chunks
            ],
            "total_results": result.total_results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/stats")
async def get_stats():
    """Get RAG system statistics."""
    try:
        count = await vector_store.count()
        return {
            "total_documents": count,
            "collection": get_settings().chroma_collection,
            "embedding_model": get_settings().embedding_model,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)
