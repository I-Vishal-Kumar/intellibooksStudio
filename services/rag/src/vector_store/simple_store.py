"""Simple In-Memory Vector Store - No external dependencies.

This provides a lightweight vector store that works without ChromaDB
for development and smaller knowledge bases.
"""

import json
import os
import logging
import pickle
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel
import numpy as np

logger = logging.getLogger(__name__)


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


def get_embedding_model(model_name: str = "all-MiniLM-L6-v2"):
    """Load sentence transformer or use simple embedder as fallback."""
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(model_name)
    except ImportError:
        logger.warning("SentenceTransformer not available, using simple embeddings")
        return SimpleEmbedder()


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


class SimpleVectorStore:
    """Simple in-memory vector store with file persistence.

    Uses numpy for fast cosine similarity search.
    """

    def __init__(
        self,
        persist_path: Optional[str] = None,
        collection_name: str = "knowledge_base",
        embedding_model: str = "all-MiniLM-L6-v2",
    ):
        self.collection_name = collection_name
        self.embedding_model_name = embedding_model

        # Set persist path
        if persist_path is None:
            persist_path = str(
                Path(__file__).parent.parent.parent.parent.parent / "data" / "vector_store"
            )
        self.persist_path = Path(persist_path)
        self.persist_path.mkdir(parents=True, exist_ok=True)

        # Data storage
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, np.ndarray] = {}

        # Lazy load embedding model
        self._embedding_model = None

        # Load existing data
        self._load()

        logger.info(f"SimpleVectorStore initialized with {len(self.documents)} documents")

    @property
    def embedding_model(self):
        """Lazy load embedding model."""
        if self._embedding_model is None:
            self._embedding_model = get_embedding_model(self.embedding_model_name)
        return self._embedding_model

    def _get_store_path(self) -> Path:
        return self.persist_path / f"{self.collection_name}.pkl"

    def _load(self):
        """Load data from disk."""
        store_path = self._get_store_path()
        if store_path.exists():
            try:
                with open(store_path, "rb") as f:
                    data = pickle.load(f)
                    self.documents = data.get("documents", {})
                    self.embeddings = data.get("embeddings", {})
                logger.info(f"Loaded {len(self.documents)} documents from {store_path}")
            except Exception as e:
                logger.error(f"Failed to load store: {e}")
                self.documents = {}
                self.embeddings = {}

    def _save(self):
        """Save data to disk."""
        store_path = self._get_store_path()
        try:
            with open(store_path, "wb") as f:
                pickle.dump({
                    "documents": self.documents,
                    "embeddings": self.embeddings,
                }, f)
        except Exception as e:
            logger.error(f"Failed to save store: {e}")

    def _generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for texts."""
        return self.embedding_model.encode(texts, convert_to_numpy=True)

    def _cosine_similarity(self, query_emb: np.ndarray, doc_embs: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between query and documents."""
        # Normalize
        query_norm = query_emb / np.linalg.norm(query_emb)
        doc_norms = doc_embs / np.linalg.norm(doc_embs, axis=1, keepdims=True)
        # Compute similarity
        return np.dot(doc_norms, query_norm)

    async def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to the vector store."""
        if not documents:
            return []

        ids = []
        contents = []

        for doc in documents:
            self.documents[doc.id] = doc
            ids.append(doc.id)
            contents.append(doc.content)

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        for i, doc_id in enumerate(ids):
            self.embeddings[doc_id] = embeddings[i]

        # Persist
        self._save()

        logger.info(f"Added {len(documents)} documents to vector store")
        return ids

    def add_documents_sync(self, documents: List[Document]) -> List[str]:
        """Synchronous version for parallel processing."""
        if not documents:
            return []

        ids = []
        contents = []

        for doc in documents:
            self.documents[doc.id] = doc
            ids.append(doc.id)
            contents.append(doc.content)

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        for i, doc_id in enumerate(ids):
            self.embeddings[doc_id] = embeddings[i]

        # Persist
        self._save()

        return ids

    async def search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """Search for similar documents."""
        if not self.documents:
            return []

        # Generate query embedding
        query_embedding = self._generate_embeddings([query])[0]

        # Filter documents if needed
        doc_ids = list(self.documents.keys())
        if filters:
            doc_ids = [
                doc_id for doc_id in doc_ids
                if self._matches_filters(self.documents[doc_id].metadata, filters)
            ]

        if not doc_ids:
            return []

        # Get embeddings for filtered documents
        doc_embeddings = np.array([self.embeddings[doc_id] for doc_id in doc_ids])

        # Compute similarities
        similarities = self._cosine_similarity(query_embedding, doc_embeddings)

        # Get top-k results
        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            doc_id = doc_ids[idx]
            doc = self.documents[doc_id]
            score = float(similarities[idx])

            if score > 0:  # Only include positive similarity
                results.append(SearchResult(
                    id=doc_id,
                    content=doc.content,
                    score=score,
                    metadata=doc.metadata,
                ))

        return results

    def _matches_filters(self, metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Check if document metadata matches filters."""
        for key, value in filters.items():
            if key not in metadata:
                return False
            if isinstance(value, list):
                if metadata[key] not in value:
                    return False
            elif metadata[key] != value:
                return False
        return True

    async def delete_documents(self, ids: List[str]) -> bool:
        """Delete documents by ID."""
        try:
            for doc_id in ids:
                self.documents.pop(doc_id, None)
                self.embeddings.pop(doc_id, None)
            self._save()
            logger.info(f"Deleted {len(ids)} documents")
            return True
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            return False

    async def delete_by_metadata(self, key: str, value: Any) -> bool:
        """Delete documents by metadata field."""
        try:
            ids_to_delete = [
                doc_id for doc_id, doc in self.documents.items()
                if doc.metadata.get(key) == value
            ]
            return await self.delete_documents(ids_to_delete)
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            return False

    async def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        return self.documents.get(doc_id)

    async def count(self) -> int:
        """Get the total number of documents."""
        return len(self.documents)

    async def clear(self) -> bool:
        """Clear all documents from the store."""
        try:
            self.documents = {}
            self.embeddings = {}
            self._save()
            logger.info("Cleared all documents from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to clear vector store: {e}")
            return False

    async def list_collections(self) -> List[str]:
        """List all collections (in this case, just the current one)."""
        return [self.collection_name]
