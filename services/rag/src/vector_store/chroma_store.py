"""Chroma Vector Store for RAG pipeline - Pydantic v2 compatible."""

import os
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel
import numpy as np

logger = logging.getLogger(__name__)

# Lazy import chromadb to handle compatibility issues
_chromadb = None
_sentence_transformer = None


def get_chromadb():
    """Lazy load chromadb with error handling."""
    global _chromadb
    if _chromadb is None:
        try:
            # Suppress pydantic warning during import
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=UserWarning)
                warnings.filterwarnings("ignore", message=".*BaseSettings.*")
                import chromadb
            _chromadb = chromadb
        except ImportError as e:
            logger.error(f"ChromaDB import error: {e}")
            raise ImportError(
                "ChromaDB not available. Install with: pip install chromadb"
            )
    return _chromadb


def get_embedding_model(model_name: str = "all-MiniLM-L6-v2"):
    """Lazy load sentence transformer model."""
    global _sentence_transformer
    if _sentence_transformer is None:
        try:
            from sentence_transformers import SentenceTransformer
            _sentence_transformer = SentenceTransformer(model_name)
        except ImportError:
            logger.warning("SentenceTransformer not available, using simple embeddings")
            _sentence_transformer = SimpleEmbedder()
    return _sentence_transformer


class SimpleEmbedder:
    """Simple fallback embedder using hash-based embeddings."""

    def __init__(self, dim: int = 384):
        self.dim = dim

    def encode(self, texts: List[str], convert_to_numpy: bool = True) -> np.ndarray:
        """Generate simple hash-based embeddings."""
        embeddings = []
        for text in texts:
            # Create deterministic embedding from text hash
            np.random.seed(hash(text) % (2**32))
            emb = np.random.randn(self.dim).astype(np.float32)
            emb = emb / np.linalg.norm(emb)  # Normalize
            embeddings.append(emb)
        return np.array(embeddings)


class Document(BaseModel):
    """A document to be indexed."""
    id: str
    content: str
    metadata: Dict[str, Any] = {}


class SearchResult(BaseModel):
    """A search result from the vector store."""
    id: str
    content: str
    score: float
    metadata: Dict[str, Any] = {}


class ChromaVectorStore:
    """Vector store using ChromaDB for semantic search.

    Uses persistent client (no separate server needed) for simplicity.
    """

    def __init__(
        self,
        persist_directory: Optional[str] = None,
        collection_name: str = "knowledge_base",
        embedding_model: str = "all-MiniLM-L6-v2",
    ):
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model

        # Set persist directory
        if persist_directory is None:
            persist_directory = str(
                Path(__file__).parent.parent.parent.parent.parent / "data" / "chroma_db"
            )
        self.persist_directory = persist_directory

        # Ensure directory exists
        os.makedirs(persist_directory, exist_ok=True)

        # Initialize components lazily
        self._client = None
        self._collection = None
        self._embedding_model = None

        logger.info(f"ChromaVectorStore configured with collection: {collection_name}")

    @property
    def client(self):
        """Lazy load ChromaDB client."""
        if self._client is None:
            chromadb = get_chromadb()
            self._client = chromadb.PersistentClient(path=self.persist_directory)
        return self._client

    @property
    def collection(self):
        """Lazy load or create collection."""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    @property
    def embedding_model(self):
        """Lazy load embedding model."""
        if self._embedding_model is None:
            self._embedding_model = get_embedding_model(self.embedding_model_name)
        return self._embedding_model

    def _generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for texts."""
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to the vector store."""
        if not documents:
            return []

        ids = [doc.id for doc in documents]
        contents = [doc.content for doc in documents]
        metadatas = [doc.metadata for doc in documents]

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        # Add to collection (upsert to handle duplicates)
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=contents,
            metadatas=metadatas,
        )

        logger.info(f"Added {len(documents)} documents to vector store")
        return ids

    def add_documents_sync(self, documents: List[Document]) -> List[str]:
        """Synchronous version for parallel processing."""
        if not documents:
            return []

        ids = [doc.id for doc in documents]
        contents = [doc.content for doc in documents]
        metadatas = [doc.metadata for doc in documents]

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        # Add to collection
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=contents,
            metadatas=metadatas,
        )

        return ids

    async def search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """Search for similar documents."""
        # Generate query embedding
        query_embedding = self._generate_embeddings([query])[0]

        # Build where clause for filters
        where = None
        if filters:
            where = {}
            for key, value in filters.items():
                if isinstance(value, list):
                    where[key] = {"$in": value}
                else:
                    where[key] = value

        # Search
        logger.info(f"🔍 ChromaVectorStore.search: query length={len(query)}, top_k={top_k}, filters={where}")
        logger.info(f"   Collection: {self.collection_name}, Collection count: {self.collection.count()}")
        
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error(f"❌ Search error: {e}", exc_info=True)
            return []

        # Convert to SearchResult objects
        search_results = []
        if results["ids"] and results["ids"][0]:
            logger.info(f"✅ ChromaDB returned {len(results['ids'][0])} results")
            for i, doc_id in enumerate(results["ids"][0]):
                # Convert distance to similarity score (cosine distance to similarity)
                distance = results["distances"][0][i] if results["distances"] else 0
                score = 1 - distance  # Convert distance to similarity
                
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                content = results["documents"][0][i] if results["documents"] else ""
                
                logger.info(f"   [{i+1}] ID: {doc_id}, Score: {score:.4f} (distance: {distance:.4f}), Metadata: {metadata}")
                logger.debug(f"      Content preview: {content[:100]}...")

                search_results.append(SearchResult(
                    id=doc_id,
                    content=content,
                    score=score,
                    metadata=metadata,
                ))
        else:
            logger.warning(f"⚠️  ChromaDB returned no results for query: '{query[:50]}...'")
            logger.info(f"   Collection has {self.collection.count()} documents total")

        logger.info(f"📊 Returning {len(search_results)} search results")
        return search_results

    async def delete_documents(self, ids: List[str]) -> bool:
        """Delete documents by ID."""
        try:
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            return False

    async def delete_by_metadata(self, key: str, value: Any) -> bool:
        """Delete documents by metadata field."""
        try:
            self.collection.delete(where={key: value})
            logger.info(f"Deleted documents where {key}={value}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            return False

    async def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        try:
            result = self.collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"],
            )

            if result["ids"]:
                return Document(
                    id=result["ids"][0],
                    content=result["documents"][0] if result["documents"] else "",
                    metadata=result["metadatas"][0] if result["metadatas"] else {},
                )
        except Exception as e:
            logger.error(f"Failed to get document: {e}")
        return None

    async def count(self) -> int:
        """Get the total number of documents."""
        try:
            return self.collection.count()
        except Exception:
            return 0

    async def clear(self) -> bool:
        """Clear all documents from the collection."""
        try:
            self.client.delete_collection(self.collection_name)
            self._collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("Cleared all documents from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to clear vector store: {e}")
            return False

    async def list_collections(self) -> List[str]:
        """List all collections."""
        try:
            collections = self.client.list_collections()
            return [c.name for c in collections]
        except Exception:
            return []
