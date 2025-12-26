"""Intellibooks Studio - RAG Service API.

Provides endpoints for document upload, knowledge base queries, and RAG operations.
Uses the IntelliBooksPipeline with Ray, RabbitMQ, and Docker ChromaDB support.
"""

import logging
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add intellibooks_db module to path
intellibooks_db_path = Path(__file__).parent.parent.parent.parent / "intellibooks_db"
if intellibooks_db_path.exists():
    services_path = str(intellibooks_db_path.parent)
    if services_path not in sys.path:
        sys.path.insert(0, services_path)

# Global instances
pipeline = None
db_pool = None
document_repo = None
session_repo = None


async def init_database():
    """Initialize database connection and repositories."""
    global db_pool, document_repo, session_repo

    try:
        from intellibooks_db.database import get_db_pool, ensure_schema, DocumentRepository, SessionRepository

        db_pool = await get_db_pool()
        if db_pool:
            await ensure_schema()
            document_repo = DocumentRepository(db_pool)
            session_repo = SessionRepository(db_pool)
            logger.info("✅ PostgreSQL persistence enabled")
        else:
            logger.warning("⚠️ Running without PostgreSQL persistence")
    except ImportError as e:
        logger.warning(f"Database module not available: {e}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")


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

    # Initialize database
    await init_database()

    yield

    # Cleanup
    logger.info("Shutting down Intellibooks RAG Service")
    if db_pool:
        from intellibooks_db.database import close_db_pool
        await close_db_pool()


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
    session_id: Optional[str] = Form(None),
):
    """Upload and process a document into the knowledge base.

    Args:
        file: The document file to upload
        document_id: Optional custom document ID
        session_id: Session/notebook to associate this document with
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        start_time = time.time()

        content = await file.read()
        filename = file.filename or "unknown"
        file_extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else None

        logger.info(f"Processing document: {filename} ({len(content)} bytes) for session: {session_id}")
        logger.info(f"Persistence check - document_repo: {document_repo is not None}, session_repo: {session_repo is not None}")

        # Ensure session exists if session_id provided
        if session_id and session_repo:
            logger.info(f"Creating/getting session: {session_id}")
            await session_repo.get_or_create(session_id, title="New Notebook")

        # Generate document_id if not provided - use same ID for both DB and pipeline
        final_document_id = document_id or f"doc-{int(time.time() * 1000)}"
        logger.info(f"Using document_id: {final_document_id}")

        # Create document record before processing (status: processing)
        doc_persisted = False
        if document_repo and session_id:
            logger.info(f"Persisting document to database...")
            doc_persisted = True
            await document_repo.create(
                document_id=final_document_id,
                session_id=session_id,
                filename=filename,
                file_type=file_extension or "unknown",
                file_extension=file_extension,
                file_size_bytes=len(content),
            )

        result = await pipeline.ingest_document(
            content=content,
            filename=filename,
            document_id=final_document_id,  # Use the same document_id
            metadata={"session_id": session_id} if session_id else None,
        )

        # Update document status after processing
        if document_repo and result.document_id:
            if result.success:
                await document_repo.update_status(
                    document_id=result.document_id,
                    status="ready",
                    chunks_count=result.chunks_created,
                )
            else:
                await document_repo.update_status(
                    document_id=result.document_id,
                    status="error",
                    error_message=result.error,
                )

        return {
            "success": result.success,
            "document_id": result.document_id,
            "filename": result.filename,
            "chunks_created": result.chunks_created,
            "processing_time_ms": result.processing_time_ms,
            "session_id": session_id,
            "persisted": doc_persisted,
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
            "retrieval_stats": response.retrieval_stats,
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
        # Delete from ChromaDB
        success = await pipeline.delete_document(document_id)

        # Delete from PostgreSQL
        db_deleted = False
        if document_repo:
            db_deleted = await document_repo.delete(document_id)

        return {
            "success": success,
            "document_id": document_id,
            "db_deleted": db_deleted,
        }
    except Exception as e:
        logger.exception(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/rag/clear")
async def clear_knowledge_base():
    """Clear all documents from the knowledge base (ChromaDB + PostgreSQL)."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        # Clear ChromaDB vector store
        chroma_success = await pipeline.clear()
        logger.info(f"ChromaDB clear result: {chroma_success}")

        # Clear PostgreSQL documents table
        db_cleared = False
        if document_repo:
            try:
                db_cleared = await document_repo.delete_all()
                logger.info(f"PostgreSQL documents cleared: {db_cleared}")
            except Exception as db_e:
                logger.error(f"Failed to clear PostgreSQL documents: {db_e}")

        return {
            "success": chroma_success,
            "chroma_cleared": chroma_success,
            "db_cleared": db_cleared,
            "message": "Knowledge base cleared" if chroma_success else "Failed to clear ChromaDB",
        }
    except Exception as e:
        logger.exception(f"Error clearing knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/documents")
async def list_documents(session_id: Optional[str] = None):
    """List all documents, optionally filtered by session."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        stats = await pipeline.get_stats()

        # If we have database persistence, return actual documents
        if document_repo:
            if session_id:
                documents = await document_repo.get_by_session(session_id)
            else:
                documents = await document_repo.list_all()

            return {
                "total_chunks": stats.get("total_chunks", 0),
                "documents": [
                    {
                        "document_id": doc["document_id"],
                        "filename": doc["filename"],
                        "file_type": doc["file_type"],
                        "file_size_bytes": doc["file_size_bytes"],
                        "chunks_count": doc["chunks_count"],
                        "status": doc["status"],
                        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
                    }
                    for doc in documents
                ],
                "total_documents": len(documents),
                "persistence_enabled": True,
            }

        # Fallback to basic stats if no database
        return {
            "total_chunks": stats.get("total_chunks", 0),
            "collection": stats.get("collection", "unknown"),
            "documents": [],
            "persistence_enabled": False,
            "message": "Document listing requires PostgreSQL persistence",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/documents/{document_id}")
async def get_document(document_id: str):
    """Get details of a specific document."""
    if not document_repo:
        raise HTTPException(status_code=503, detail="Document persistence not enabled")

    try:
        doc = await document_repo.get_by_document_id(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        return {
            "document_id": doc["document_id"],
            "filename": doc["filename"],
            "file_type": doc["file_type"],
            "file_extension": doc["file_extension"],
            "file_size_bytes": doc["file_size_bytes"],
            "chunks_count": doc["chunks_count"],
            "total_chars": doc["total_chars"],
            "status": doc["status"],
            "error_message": doc.get("error_message"),
            "session_id": doc.get("session_string_id"),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
            "processed_at": doc["processed_at"].isoformat() if doc.get("processed_at") else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Knowledge Graph Endpoints ============

class DocumentSummaryRequest(BaseModel):
    """Request for generating document summary."""
    document_id: str
    max_length: int = 300


class KnowledgeGraphRequest(BaseModel):
    """Request for generating knowledge graph."""
    session_id: Optional[str] = None
    max_nodes: int = 50  # Increased for more detailed graph
    include_relationships: bool = True
    depth: int = 4  # Tree depth (levels)


@app.post("/api/rag/document-summary")
async def generate_document_summary(request: DocumentSummaryRequest):
    """Generate a summary of an uploaded document.

    Called automatically after document upload to provide a brief overview
    in the chat interface.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        # Search for content from this specific document
        search_results = await pipeline.search(
            query="main summary overview key points highlights",
            top_k=10,
            filters={"document_id": request.document_id} if request.document_id else None,
        )

        if not search_results:
            return {
                "success": False,
                "error": "No content found for document",
                "summary": None,
            }

        # Combine top chunks for context
        combined_content = "\n".join([r.content[:500] for r in search_results[:5]])

        # Extract key info
        filename = search_results[0].metadata.get("filename", "Document")
        total_chunks = len(search_results)

        # Generate summary using the LLM
        summary_prompt = f"""Based on the following content from "{filename}", provide a brief 2-3 sentence summary of what this document is about:

{combined_content}

Summary:"""

        # Use the pipeline's query method for LLM generation
        summary_response = await pipeline.query(
            query=summary_prompt,
            top_k=0,  # Don't need additional context
        )

        # RAGResponse is a dataclass, access attribute directly
        summary = summary_response.answer if summary_response else ""

        # Fallback: extract first meaningful sentences if LLM fails
        if not summary or len(summary) < 20:
            sentences = combined_content.split('.')[:3]
            summary = '. '.join(s.strip() for s in sentences if s.strip()) + '.'
            if len(summary) > request.max_length:
                summary = summary[:request.max_length] + "..."

        return {
            "success": True,
            "document_id": request.document_id,
            "filename": filename,
            "summary": summary,
            "chunks_analyzed": total_chunks,
        }

    except Exception as e:
        logger.exception(f"Error generating document summary: {e}")
        return {
            "success": False,
            "error": str(e),
            "summary": None,
        }


@app.post("/api/rag/knowledge-graph")
async def generate_knowledge_graph(request: KnowledgeGraphRequest):
    """Generate a knowledge graph from the indexed documents.

    If Neo4j is available, returns entity-relationship graph from Neo4j.
    Otherwise falls back to keyword-extraction based graph.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        # Get stats to check if documents exist
        stats = await pipeline.get_stats()

        if stats.get("total_chunks", 0) == 0:
            return {
                "success": False,
                "error": "No documents indexed",
                "nodes": [],
                "edges": [],
            }

        # Try Neo4j-based graph first - this will initialize Neo4j if needed
        neo4j_graph = await pipeline.get_knowledge_graph(
            session_id=request.session_id,
            limit=request.max_nodes,
        )

        # Check if Neo4j returned data
        if neo4j_graph.get("nodes"):
            # Transform to match expected format
            nodes = []
            edges = []

            # Color mapping for entity types
            type_colors = {
                "Person": "bg-[#bfdbfe]",
                "Organization": "bg-[#dbeafe]",
                "Concept": "bg-[#bbf7d0]",
                "Topic": "bg-[#fde68a]",
                "Event": "bg-[#fecaca]",
                "Location": "bg-[#ddd6fe]",
                "Product": "bg-[#a7f3d0]",
                "Technology": "bg-[#7dd3fc]",
                "Date": "bg-[#fcd34d]",
                "Metric": "bg-[#fca5a5]",
            }

            for node in neo4j_graph["nodes"]:
                entity_type = node.get("type", "Concept")
                nodes.append({
                    "id": node["id"],
                    "label": node["label"],
                    "type": entity_type.lower(),
                    "color": type_colors.get(entity_type, "bg-[#f3f4f6]"),
                    "level": 1,
                    "metadata": {
                        "entity_type": entity_type,
                        "description": node.get("description"),
                        "confidence": node.get("confidence", 1.0),
                    },
                })

            for edge in neo4j_graph["edges"]:
                edges.append({
                    "id": edge["id"],
                    "source": edge["source"],
                    "target": edge["target"],
                    "label": edge.get("label", "RELATED_TO"),
                })

            # Get updated stats now that Neo4j is initialized
            updated_stats = await pipeline.get_stats()
            graph_stats = updated_stats.get("knowledge_graph", {})

            return {
                "success": True,
                "nodes": nodes,
                "edges": edges,
                "source": "neo4j",
                "metadata": {
                    "extraction_method": "llm_entity_extraction",
                    "neo4j_available": True,
                },
                "statistics": {
                    "tree_size": len(nodes),
                    "total_edges": len(edges),
                    "entities": graph_stats.get("entities", len(nodes)),
                    "relationships": graph_stats.get("relationships", len(edges)),
                },
            }

        # Fallback to keyword-based extraction
        return await _generate_basic_knowledge_graph(request)

    except Exception as e:
        logger.exception(f"Error generating knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class EntitySearchRequest(BaseModel):
    """Request for searching entities."""
    query: str
    limit: int = 20


class EntityPathRequest(BaseModel):
    """Request for finding path between entities."""
    source_id: str
    target_id: str
    max_depth: int = 5


@app.post("/api/rag/graph/entities/search")
async def search_entities(request: EntitySearchRequest):
    """Search for entities in the knowledge graph by name."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        entities = await pipeline.search_entities(request.query, request.limit)
        return {
            "success": True,
            "query": request.query,
            "entities": entities,
            "count": len(entities),
        }
    except Exception as e:
        logger.exception(f"Error searching entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/graph/entities/{entity_id}")
async def get_entity_details(entity_id: str):
    """Get details of a specific entity including its relationships."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        result = await pipeline.get_entity_details(entity_id)
        entity = result.get("entity")

        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        return {
            "success": True,
            "entity": {
                "id": entity.id,
                "name": entity.name,
                "type": entity.type,
                "description": entity.description,
                "confidence": entity.confidence,
            },
            "relationships": result.get("relationships", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting entity details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/graph/path")
async def find_entity_path(request: EntityPathRequest):
    """Find the shortest path between two entities in the knowledge graph."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        path = await pipeline.find_entity_path(
            request.source_id,
            request.target_id,
            request.max_depth,
        )

        return {
            "success": True,
            "source_id": request.source_id,
            "target_id": request.target_id,
            "path": path,
            "path_length": len(path) - 1 if path else 0,
        }
    except Exception as e:
        logger.exception(f"Error finding entity path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/graph/stats")
async def get_graph_stats():
    """Get knowledge graph statistics."""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        stats = await pipeline.get_stats()
        graph_stats = stats.get("knowledge_graph", {})

        return {
            "success": True,
            "neo4j_available": stats.get("neo4j_available", False),
            "knowledge_graph_enabled": stats.get("knowledge_graph_enabled", False),
            "statistics": graph_stats,
        }
    except Exception as e:
        logger.exception(f"Error getting graph stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _generate_basic_knowledge_graph(request: KnowledgeGraphRequest):
    """Generate a detailed knowledge graph with hierarchical structure.

    Creates a tree with:
    - Root node (document name)
    - Level 1: Main themes/categories
    - Level 2: Sub-topics
    - Level 3: Concepts
    - Level 4: Details/entities (leaf nodes)

    Returns graph statistics including tree height, size, leaf count, etc.
    """
    try:
        # Search for representative content with broad query
        search_results = await pipeline.search(
            query="main topics concepts themes summary key points sections",
            top_k=100,  # Get more chunks for better coverage
        )

        if not search_results:
            return {
                "success": False,
                "error": "No content found",
                "nodes": [],
                "edges": [],
            }

        # Extract unique document sources
        documents = {}
        all_chunks_text = []
        for result in search_results:
            doc_id = result.metadata.get("document_id", "unknown")
            filename = result.metadata.get("filename", "Document")
            if doc_id not in documents:
                documents[doc_id] = {
                    "id": doc_id,
                    "filename": filename,
                    "chunks": [],
                }
            documents[doc_id]["chunks"].append(result.content)
            all_chunks_text.append(result.content)

        # Build graph structure
        nodes = []
        edges = []

        # Root node (Level 0) - Named after first document or "Knowledge Base"
        root_label = "Knowledge Base"
        if documents:
            first_doc = list(documents.values())[0]
            fname = first_doc["filename"]
            root_label = fname.rsplit(".", 1)[0]
            if len(root_label) > 35:
                root_label = root_label[:32] + "..."

        nodes.append({
            "id": "root",
            "label": root_label,
            "type": "root",
            "color": "bg-gradient-to-r from-indigo-500 to-purple-600",
            "level": 0,
            "metadata": {"total_documents": len(documents), "is_root": True},
        })

        # Extract comprehensive keywords with different granularities
        combined_text = " ".join(all_chunks_text)

        # Level 1: Main themes (broad categories) - extract top keywords
        main_themes = _extract_keywords(combined_text, max_keywords=8)

        # Level 2: Sub-topics for each theme
        theme_subtopics = {}
        for theme in main_themes:
            # Find chunks that mention this theme
            theme_chunks = [c for c in all_chunks_text if theme.lower() in c.lower()]
            if theme_chunks:
                subtopic_text = " ".join(theme_chunks[:10])
                subtopics = _extract_keywords(subtopic_text, max_keywords=6)
                # Filter out the parent theme
                subtopics = [s for s in subtopics if s.lower() != theme.lower()][:4]
                theme_subtopics[theme] = subtopics

        # Level 3: Concepts under subtopics
        subtopic_concepts = {}
        for theme, subtopics in theme_subtopics.items():
            for subtopic in subtopics:
                concept_chunks = [c for c in all_chunks_text if subtopic.lower() in c.lower()]
                if concept_chunks:
                    concept_text = " ".join(concept_chunks[:5])
                    concepts = _extract_keywords(concept_text, max_keywords=4)
                    concepts = [c for c in concepts if c.lower() not in [theme.lower(), subtopic.lower()]][:3]
                    subtopic_concepts[f"{theme}_{subtopic}"] = concepts

        # Level 4: Details/entities (leaf nodes) - extract named entities and specifics
        concept_details = {}
        for key, concepts in subtopic_concepts.items():
            for concept in concepts:
                detail_chunks = [c for c in all_chunks_text if concept.lower() in c.lower()]
                if detail_chunks:
                    detail_text = " ".join(detail_chunks[:3])
                    # Extract more specific terms (numbers, proper nouns, etc.)
                    details = _extract_details(detail_text, max_details=3)
                    details = [d for d in details if d.lower() != concept.lower()][:2]
                    concept_details[f"{key}_{concept}"] = details

        # Color palette for different levels
        level_colors = {
            1: ["bg-[#bfdbfe]", "bg-[#dbeafe]", "bg-[#e0e7ff]", "bg-[#c7d2fe]",
                "bg-[#a5b4fc]", "bg-[#93c5fd]", "bg-[#7dd3fc]", "bg-[#6ee7b7]"],
            2: ["bg-[#bbf7d0]", "bg-[#fde68a]", "bg-[#fecaca]", "bg-[#ddd6fe]",
                "bg-[#a7f3d0]", "bg-[#fcd34d]", "bg-[#fca5a5]", "bg-[#c4b5fd]"],
            3: ["bg-[#f3f4f6]", "bg-[#e5e7eb]", "bg-[#d1d5db]", "bg-[#fef3c7]"],
            4: ["bg-[#f9fafb]", "bg-[#f3f4f6]", "bg-[#fef9c3]", "bg-[#fce7f3]"],
        }

        # Build Level 1 nodes (main themes)
        theme_node_ids = {}
        for i, theme in enumerate(main_themes):
            if len(nodes) >= request.max_nodes:
                break

            theme_node_id = f"theme_{i}"
            theme_node_ids[theme] = theme_node_id

            nodes.append({
                "id": theme_node_id,
                "label": theme,
                "type": "theme",
                "color": level_colors[1][i % len(level_colors[1])],
                "level": 1,
                "metadata": {
                    "is_theme": True,
                    "child_count": len(theme_subtopics.get(theme, [])),
                },
            })

            edges.append({
                "id": f"e-root-{theme_node_id}",
                "source": "root",
                "target": theme_node_id,
            })

        # Build Level 2 nodes (subtopics)
        subtopic_node_ids = {}
        for theme, subtopics in theme_subtopics.items():
            if theme not in theme_node_ids:
                continue

            for j, subtopic in enumerate(subtopics):
                if len(nodes) >= request.max_nodes:
                    break

                subtopic_node_id = f"subtopic_{theme}_{j}"
                subtopic_node_ids[f"{theme}_{subtopic}"] = subtopic_node_id

                nodes.append({
                    "id": subtopic_node_id,
                    "label": subtopic,
                    "type": "subtopic",
                    "color": level_colors[2][j % len(level_colors[2])],
                    "level": 2,
                    "metadata": {
                        "parent_theme": theme,
                        "child_count": len(subtopic_concepts.get(f"{theme}_{subtopic}", [])),
                    },
                })

                edges.append({
                    "id": f"e-{theme_node_ids[theme]}-{subtopic_node_id}",
                    "source": theme_node_ids[theme],
                    "target": subtopic_node_id,
                })

        # Build Level 3 nodes (concepts)
        concept_node_ids = {}
        for key, concepts in subtopic_concepts.items():
            if key not in subtopic_node_ids:
                continue

            for k, concept in enumerate(concepts):
                if len(nodes) >= request.max_nodes:
                    break

                concept_node_id = f"concept_{key}_{k}"
                concept_node_ids[f"{key}_{concept}"] = concept_node_id

                nodes.append({
                    "id": concept_node_id,
                    "label": concept,
                    "type": "concept",
                    "color": level_colors[3][k % len(level_colors[3])],
                    "level": 3,
                    "metadata": {
                        "parent_subtopic": key,
                        "child_count": len(concept_details.get(f"{key}_{concept}", [])),
                    },
                })

                edges.append({
                    "id": f"e-{subtopic_node_ids[key]}-{concept_node_id}",
                    "source": subtopic_node_ids[key],
                    "target": concept_node_id,
                })

        # Build Level 4 nodes (details - leaf nodes)
        for key, details in concept_details.items():
            if key not in concept_node_ids:
                continue

            for m, detail in enumerate(details):
                if len(nodes) >= request.max_nodes:
                    break

                detail_node_id = f"detail_{key}_{m}"

                nodes.append({
                    "id": detail_node_id,
                    "label": detail,
                    "type": "detail",
                    "color": level_colors[4][m % len(level_colors[4])],
                    "level": 4,
                    "metadata": {
                        "parent_concept": key,
                        "is_leaf": True,
                    },
                })

                edges.append({
                    "id": f"e-{concept_node_ids[key]}-{detail_node_id}",
                    "source": concept_node_ids[key],
                    "target": detail_node_id,
                })

        # Calculate tree statistics
        leaf_nodes = [n for n in nodes if n.get("metadata", {}).get("is_leaf", False) or
                     not any(e["source"] == n["id"] for e in edges)]
        parent_nodes = [n for n in nodes if any(e["source"] == n["id"] for e in edges)]
        child_nodes = [n for n in nodes if any(e["target"] == n["id"] for e in edges)]

        max_level = max(n["level"] for n in nodes) if nodes else 0
        tree_height = max_level + 1  # Including root

        # Count nodes by level
        nodes_by_level = {}
        for n in nodes:
            level = n["level"]
            nodes_by_level[level] = nodes_by_level.get(level, 0) + 1

        return {
            "success": True,
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_documents": len(documents),
                "extraction_method": "hierarchical_keyword_extraction",
            },
            "statistics": {
                "tree_size": len(nodes),
                "tree_height": tree_height,
                "total_edges": len(edges),
                "leaf_nodes": len(leaf_nodes),
                "parent_nodes": len(parent_nodes),
                "child_nodes": len(child_nodes),
                "nodes_by_level": nodes_by_level,
                "level_names": {
                    0: "Root",
                    1: "Themes",
                    2: "Subtopics",
                    3: "Concepts",
                    4: "Details",
                },
            },
        }

    except Exception as e:
        logger.exception(f"Error in basic knowledge graph: {e}")
        return {
            "success": False,
            "error": str(e),
            "nodes": [],
            "edges": [],
        }


def _extract_keywords(text: str, max_keywords: int = 5) -> List[str]:
    """Extract keywords from text using simple frequency analysis."""
    import re
    from collections import Counter

    # Common stop words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
        'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
        'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
        'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
        'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
        'if', 'else', 'because', 'until', 'while', 'about', 'into', 'through',
        'during', 'before', 'after', 'above', 'below', 'between', 'under',
        'source', 'document', 'file', 'page', 'chapter', 'section', 'data',
    }

    # Extract words (letters only, 3+ chars)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())

    # Filter stop words and count
    filtered = [w for w in words if w not in stop_words and len(w) > 3]
    word_counts = Counter(filtered)

    # Get top keywords and capitalize them
    keywords = [word.title() for word, _ in word_counts.most_common(max_keywords)]
    return keywords


def _extract_details(text: str, max_details: int = 3) -> List[str]:
    """Extract specific details like numbers, proper nouns, and named entities."""
    import re
    from collections import Counter

    details = []

    # Extract numbers with context (e.g., "₹500 crore", "25%", "Q3 2024")
    number_patterns = [
        r'(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d+)?\s*(?:crore|lakh|million|billion)?',
        r'\d+(?:\.\d+)?%',
        r'(?:Q[1-4]|FY)\s*\d{2,4}',
        r'\d{1,2}(?:st|nd|rd|th)\s+\w+\s+\d{4}',
    ]

    for pattern in number_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        details.extend(matches[:2])

    # Extract capitalized phrases (potential proper nouns/entities)
    # Matches 2-4 consecutive capitalized words
    cap_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b'
    cap_matches = re.findall(cap_pattern, text)

    # Filter out common phrases
    common_phrases = {'the', 'this', 'that', 'these', 'those', 'january', 'february',
                      'march', 'april', 'may', 'june', 'july', 'august', 'september',
                      'october', 'november', 'december', 'monday', 'tuesday', 'wednesday',
                      'thursday', 'friday', 'saturday', 'sunday'}

    for phrase in cap_matches:
        words = phrase.lower().split()
        if not any(w in common_phrases for w in words):
            if phrase not in details and len(phrase) < 30:
                details.append(phrase)

    # Extract acronyms (2-5 capital letters)
    acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
    acronym_counts = Counter(acronyms)
    for acronym, _ in acronym_counts.most_common(2):
        if acronym not in details and acronym not in {'THE', 'AND', 'FOR', 'WITH'}:
            details.append(acronym)

    # Deduplicate and limit
    seen = set()
    unique_details = []
    for d in details:
        d_lower = d.lower()
        if d_lower not in seen:
            seen.add(d_lower)
            unique_details.append(d)

    return unique_details[:max_details]


# ============ Audio & Video Generation Endpoints ============

class AudioGenerationRequest(BaseModel):
    """Request for audio overview generation."""
    session_id: Optional[str] = None
    format: str = "deep_dive"  # deep_dive, brief, critique, debate
    language: str = "en-US"
    length: str = "default"  # short, default, long
    custom_topic: Optional[str] = None


class VideoGenerationRequest(BaseModel):
    """Request for video overview generation."""
    session_id: Optional[str] = None
    orientation: str = "landscape"  # landscape, portrait, square
    detail_level: str = "standard"  # concise, standard, detailed
    include_audio: bool = True
    audio_language: str = "en-US"


@app.post("/api/rag/generate-audio")
async def generate_audio_overview(request: AudioGenerationRequest):
    """Generate an audio summary of the indexed documents.

    Uses Edge TTS for high-quality text-to-speech conversion.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        from ..media_generation.audio_generator import (
            AudioGenerator, AudioConfig, AudioFormat, AudioLength
        )

        # Get document content
        search_results = await pipeline.search(
            query="main summary key points overview highlights",
            top_k=20,
        )

        if not search_results:
            raise HTTPException(status_code=400, detail="No documents indexed for audio generation")

        # Combine content
        combined_content = "\n\n".join([r.content for r in search_results])

        # Get title from first document
        filename = search_results[0].metadata.get("filename", "Document Summary")
        title = filename.rsplit(".", 1)[0] if "." in filename else filename

        # Create config
        config = AudioConfig(
            format=AudioFormat(request.format),
            language=request.language,
            length=AudioLength(request.length),
            custom_topic=request.custom_topic,
        )

        # Generate audio
        generator = AudioGenerator()
        result = await generator.generate_audio_summary(
            document_content=combined_content,
            document_title=title,
            config=config,
            session_id=request.session_id,
        )

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)

        return {
            "success": True,
            "audio_path": result.audio_path,
            "duration_seconds": result.duration_seconds,
            "file_size_bytes": result.file_size_bytes,
            "title": result.title,
            "processing_time_ms": result.processing_time_ms,
            "metadata": result.metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Audio generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/audio/{session_id}/{filename}")
async def get_audio_file(session_id: str, filename: str):
    """Serve generated audio file."""
    audio_path = Path("data/audio_output") / session_id / filename

    if not audio_path.exists():
        # Try without session
        audio_path = Path("data/audio_output") / filename
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=filename,
    )


@app.post("/api/rag/generate-video")
async def generate_video_overview(request: VideoGenerationRequest):
    """Generate a video summary of the indexed documents.

    Uses DALL-E for images and Edge TTS for narration.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="RAG service not initialized")

    try:
        from ..media_generation.video_generator import (
            VideoGenerator, VideoConfig, VideoOrientation, VideoDetailLevel
        )

        # Get document content
        search_results = await pipeline.search(
            query="main summary key points overview highlights",
            top_k=20,
        )

        if not search_results:
            raise HTTPException(status_code=400, detail="No documents indexed for video generation")

        # Combine content
        combined_content = "\n\n".join([r.content for r in search_results])

        # Get title from first document
        filename = search_results[0].metadata.get("filename", "Document Summary")
        title = filename.rsplit(".", 1)[0] if "." in filename else filename

        # Create config
        config = VideoConfig(
            orientation=VideoOrientation(request.orientation),
            detail_level=VideoDetailLevel(request.detail_level),
            include_audio=request.include_audio,
            audio_language=request.audio_language,
        )

        # Generate video
        generator = VideoGenerator()
        result = await generator.generate_video_summary(
            document_content=combined_content,
            document_title=title,
            config=config,
            session_id=request.session_id,
        )

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)

        return {
            "success": True,
            "video_path": result.video_path,
            "duration_seconds": result.duration_seconds,
            "file_size_bytes": result.file_size_bytes,
            "title": result.title,
            "processing_time_ms": result.processing_time_ms,
            "metadata": result.metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Video generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rag/video/{session_id}/{filename}")
async def get_video_file(session_id: str, filename: str):
    """Serve generated video file."""
    video_path = Path("data/video_output") / session_id / filename

    if not video_path.exists():
        # Try without session
        video_path = Path("data/video_output") / filename
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=filename,
    )


@app.get("/api/rag/tts-voices")
async def list_tts_voices(language: Optional[str] = None):
    """List available TTS voices."""
    try:
        from ..media_generation.audio_generator import AudioGenerator
        voices = await AudioGenerator.list_voices(language)
        return {"voices": voices, "count": len(voices)}
    except Exception as e:
        logger.exception(f"Failed to list voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
