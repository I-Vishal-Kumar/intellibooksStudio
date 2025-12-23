"""Chroma Vector Store for RAG pipeline - Pydantic v2 compatible.

Supports both HTTP mode (Docker ChromaDB) and Persistent mode (local file-based).
The mode is determined automatically:
- If CHROMA_USE_HTTP=true and Docker ChromaDB is available, uses HTTP mode
- Otherwise falls back to persistent mode

This ensures both RAG service and research agents use the same ChromaDB instance.
"""

import os
import logging
import time
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel
import numpy as np

logger = logging.getLogger(__name__)

# How often to try reconnecting to HTTP mode (in seconds)
HTTP_RECONNECT_INTERVAL = 30

# Lazy import chromadb to handle compatibility issues
_chromadb = None
_sentence_transformer = None
_http_client_cache = {}  # Cache HTTP clients by host:port


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


def get_chroma_settings():
    """Get ChromaDB settings from environment."""
    from dotenv import load_dotenv

    # Try to load .env from project root
    project_root = Path(__file__).parent.parent.parent.parent.parent
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    # Determine persist directory
    persist_dir = os.getenv("CHROMA_PERSIST_DIRECTORY")
    if not persist_dir:
        persist_dir = str(project_root / "data" / "chroma_db")

    return {
        "host": os.getenv("CHROMA_HOST", "localhost"),
        "port": int(os.getenv("CHROMA_PORT", "8000")),
        "collection": os.getenv("CHROMA_COLLECTION", "intellibooks_knowledge"),
        "use_http": os.getenv("CHROMA_USE_HTTP", "true").lower() == "true",
        "persist_directory": persist_dir,
    }


class ChromaHTTPClientWrapper:
    """HTTP client wrapper for ChromaDB Docker instance.

    Provides a consistent interface matching the PersistentClient pattern.
    """

    def __init__(self, host: str = "localhost", port: int = 8000):
        self.base_url = f"http://{host}:{port}"
        self._tenant = "default_tenant"
        self._database = "default_database"
        self._collection_cache = {}  # Cache collection objects

    def _api_base(self) -> str:
        """Get the base path for tenant/database scoped API calls."""
        return f"/api/v2/tenants/{self._tenant}/databases/{self._database}"

    def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make HTTP request to ChromaDB."""
        import httpx
        url = f"{self.base_url}{path}"
        with httpx.Client(timeout=60.0) as client:
            response = client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json() if response.content else {}

    def heartbeat(self) -> int:
        """Check if ChromaDB is alive."""
        result = self._request("GET", "/api/v2/heartbeat")
        return result.get("nanosecond heartbeat", 0)

    def get_or_create_collection(self, name: str, metadata: dict = None):
        """Get or create a collection, returns a collection-like object."""
        if name in self._collection_cache:
            return self._collection_cache[name]

        # Try to get existing collection first
        collection_id = name
        try:
            result = self._request("GET", f"{self._api_base()}/collections/{name}")
            collection_id = result.get("id", name)
        except Exception:
            # Create new collection
            result = self._request(
                "POST",
                f"{self._api_base()}/collections",
                json={
                    "name": name,
                    "metadata": metadata or {"hnsw:space": "cosine"},
                    "get_or_create": True
                }
            )
            collection_id = result.get("id", name)

        # Create collection wrapper
        collection = HTTPCollectionWrapper(self, name, collection_id)
        self._collection_cache[name] = collection
        return collection

    def delete_collection(self, name: str):
        """Delete a collection."""
        if name in self._collection_cache:
            collection_id = self._collection_cache[name].collection_id
            del self._collection_cache[name]
        else:
            try:
                result = self._request("GET", f"{self._api_base()}/collections/{name}")
                collection_id = result.get("id", name)
            except Exception:
                return  # Collection doesn't exist

        self._request("DELETE", f"{self._api_base()}/collections/{collection_id}")


class HTTPCollectionWrapper:
    """Wrapper for HTTP-based collection operations."""

    def __init__(self, client: ChromaHTTPClientWrapper, name: str, collection_id: str):
        self.client = client
        self.name = name
        self.collection_id = collection_id

    def upsert(self, ids: list, embeddings: list, documents: list, metadatas: list):
        """Upsert documents to collection."""
        self.client._request(
            "POST",
            f"{self.client._api_base()}/collections/{self.collection_id}/upsert",
            json={
                "ids": ids,
                "embeddings": embeddings,
                "documents": documents,
                "metadatas": metadatas,
            }
        )

    def query(self, query_embeddings: list, n_results: int = 5,
              where: dict = None, include: list = None) -> dict:
        """Query collection for similar documents."""
        body = {
            "query_embeddings": query_embeddings,
            "n_results": n_results,
            "include": include or ["documents", "metadatas", "distances"],
        }
        if where:
            body["where"] = where

        return self.client._request(
            "POST",
            f"{self.client._api_base()}/collections/{self.collection_id}/query",
            json=body
        )

    def get(self, ids: list = None, where: dict = None, include: list = None) -> dict:
        """Get documents by ID or filter."""
        body = {"include": include or ["documents", "metadatas"]}
        if ids:
            body["ids"] = ids
        if where:
            body["where"] = where

        return self.client._request(
            "POST",
            f"{self.client._api_base()}/collections/{self.collection_id}/get",
            json=body
        )

    def delete(self, ids: list = None, where: dict = None):
        """Delete documents."""
        body = {}
        if ids:
            body["ids"] = ids
        if where:
            body["where"] = where

        self.client._request(
            "POST",
            f"{self.client._api_base()}/collections/{self.collection_id}/delete",
            json=body
        )

    def count(self) -> int:
        """Count documents in collection."""
        result = self.client._request(
            "GET",
            f"{self.client._api_base()}/collections/{self.collection_id}/count"
        )
        return result if isinstance(result, int) else 0


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

    Supports both HTTP mode (Docker ChromaDB) and Persistent mode (local file-based).
    The mode is determined automatically based on environment settings and availability.

    When Docker ChromaDB is available (CHROMA_USE_HTTP=true), it uses HTTP mode.
    Otherwise, it falls back to persistent mode with local file storage.

    If HTTP connection fails during operation, it automatically falls back to persistent mode.
    """

    def __init__(
        self,
        persist_directory: Optional[str] = None,
        collection_name: str = "knowledge_base",
        embedding_model: str = "all-MiniLM-L6-v2",
        chroma_host: Optional[str] = None,
        chroma_port: Optional[int] = None,
        use_http: Optional[bool] = None,
    ):
        # Get settings from environment if not provided
        settings = get_chroma_settings()

        self.collection_name = collection_name
        self.embedding_model_name = embedding_model
        self.chroma_host = chroma_host or settings["host"]
        self.chroma_port = chroma_port or settings["port"]
        self._use_http_config = use_http if use_http is not None else settings["use_http"]
        self._use_http = None  # Will be determined on first access
        self._fallback_triggered = False  # Track if we've fallen back from HTTP
        self._last_http_check = 0.0  # Last time we checked if HTTP is available again

        # Set persist directory
        if persist_directory is None:
            persist_directory = settings["persist_directory"]
        self.persist_directory = persist_directory

        # Ensure directory exists (for fallback mode)
        os.makedirs(persist_directory, exist_ok=True)

        # Initialize components lazily
        self._client = None
        self._collection = None
        self._embedding_model = None

        logger.info(f"ChromaVectorStore configured with collection: {collection_name}")

    def _reset_client(self):
        """Reset client and collection to allow reconnection or fallback."""
        self._client = None
        self._collection = None
        logger.info("ChromaDB client reset - will reconnect on next operation")

    def _fallback_to_persistent(self):
        """Force fallback to persistent client mode."""
        if self._fallback_triggered:
            return  # Already in persistent mode due to fallback

        logger.warning("Triggering fallback from HTTP to persistent ChromaDB client")
        self._client = None
        self._collection = None
        self._fallback_triggered = True  # Prevent HTTP retry until reset
        self._last_http_check = time.time()  # Record when we fell back
        # Force get persistent client
        _ = self.client

    def _try_reconnect_http(self) -> bool:
        """Try to reconnect to HTTP mode if we're in fallback persistent mode.

        Returns True if successfully reconnected to HTTP, False otherwise.
        Only attempts reconnection every HTTP_RECONNECT_INTERVAL seconds.
        """
        # Only try if we're in fallback mode and HTTP is configured
        if not self._fallback_triggered or not self._use_http_config:
            return False

        # Check if enough time has passed since last check
        current_time = time.time()
        if current_time - self._last_http_check < HTTP_RECONNECT_INTERVAL:
            return False

        self._last_http_check = current_time
        logger.info("Checking if HTTP ChromaDB is available again...")

        try:
            # Try to connect to HTTP
            http_client = ChromaHTTPClientWrapper(
                host=self.chroma_host,
                port=self.chroma_port,
            )
            http_client.heartbeat()

            # Success! Switch back to HTTP mode
            logger.info(f"✅ HTTP ChromaDB is available again at {self.chroma_host}:{self.chroma_port}")
            logger.info("Switching from persistent mode back to HTTP mode")

            # Reset state
            self._client = http_client
            self._collection = None  # Will be re-created on next access
            self._use_http = True
            self._fallback_triggered = False

            return True
        except Exception as e:
            logger.debug(f"HTTP ChromaDB still unavailable: {e}")
            return False

    def _is_connection_error(self, error: Exception) -> bool:
        """Check if an error is a connection-related error that should trigger fallback."""
        error_str = str(error).lower()
        connection_indicators = [
            "connection refused",
            "connect call failed",
            "winerror 10061",  # Windows connection refused
            "10061",  # Windows error code
            "[errno 111]",  # Linux connection refused
            "connection reset",
            "connection aborted",
            "connection timeout",
            "no route to host",
            "network is unreachable",
            "httpx",
            "connecterror",
            "readtimeout",
            "connectionerror",
            "target machine actively refused",
        ]
        return any(indicator in error_str for indicator in connection_indicators)

    @property
    def client(self):
        """Lazy load ChromaDB client - tries HTTP first, falls back to persistent."""
        if self._client is None:
            # Try HTTP client first if configured and not already fallen back
            if self._use_http_config and not self._fallback_triggered:
                try:
                    http_client = ChromaHTTPClientWrapper(
                        host=self.chroma_host,
                        port=self.chroma_port,
                    )
                    # Verify connection with heartbeat
                    http_client.heartbeat()
                    self._client = http_client
                    self._use_http = True
                    logger.info(f"Connected to ChromaDB HTTP server at {self.chroma_host}:{self.chroma_port}")
                except Exception as e:
                    logger.warning(f"Failed to connect to ChromaDB HTTP server: {e}")
                    logger.info("Falling back to ChromaDB persistent client...")

            # Use persistent client if HTTP failed or not configured
            if self._client is None:
                chromadb = get_chromadb()
                self._client = chromadb.PersistentClient(path=self.persist_directory)
                self._use_http = False
                logger.info(f"Using ChromaDB persistent client at {self.persist_directory}")

        return self._client

    @property
    def collection(self):
        """Lazy load or create collection.

        If HTTP connection fails, triggers fallback to persistent mode.
        """
        if self._collection is None:
            max_attempts = 2
            for attempt in range(max_attempts):
                try:
                    self._collection = self.client.get_or_create_collection(
                        name=self.collection_name,
                        metadata={"hnsw:space": "cosine"},
                    )
                    break
                except Exception as e:
                    logger.error(f"❌ Collection access error (attempt {attempt + 1}): {e}")
                    if self._use_http and self._is_connection_error(e) and attempt < max_attempts - 1:
                        logger.warning("Connection error detected - triggering fallback to persistent mode")
                        self._fallback_to_persistent()
                        continue
                    else:
                        raise
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
        """Add documents to the vector store.

        If HTTP connection fails, automatically falls back to persistent mode and retries.
        Periodically checks if HTTP becomes available again when in fallback mode.
        """
        if not documents:
            return []

        # Try to reconnect to HTTP if we're in fallback mode
        self._try_reconnect_http()

        ids = [doc.id for doc in documents]
        contents = [doc.content for doc in documents]
        metadatas = [doc.metadata for doc in documents]

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        # Add to collection with automatic fallback
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                self.collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=contents,
                    metadatas=metadatas,
                )
                logger.info(f"Added {len(documents)} documents to vector store")
                return ids
            except Exception as e:
                logger.error(f"❌ Add documents error (attempt {attempt + 1}): {e}")
                if self._use_http and self._is_connection_error(e) and attempt < max_attempts - 1:
                    logger.warning("Connection error detected - triggering fallback to persistent mode")
                    self._fallback_to_persistent()
                    continue
                else:
                    raise

        return ids

    def add_documents_sync(self, documents: List[Document]) -> List[str]:
        """Synchronous version for parallel processing.

        If HTTP connection fails, automatically falls back to persistent mode and retries.
        Periodically checks if HTTP becomes available again when in fallback mode.
        """
        if not documents:
            return []

        # Try to reconnect to HTTP if we're in fallback mode
        self._try_reconnect_http()

        ids = [doc.id for doc in documents]
        contents = [doc.content for doc in documents]
        metadatas = [doc.metadata for doc in documents]

        # Generate embeddings
        embeddings = self._generate_embeddings(contents)

        # Add to collection with automatic fallback
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                self.collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=contents,
                    metadatas=metadatas,
                )
                return ids
            except Exception as e:
                logger.error(f"❌ Add documents sync error (attempt {attempt + 1}): {e}")
                if self._use_http and self._is_connection_error(e) and attempt < max_attempts - 1:
                    logger.warning("Connection error detected - triggering fallback to persistent mode")
                    self._fallback_to_persistent()
                    continue
                else:
                    raise

        return ids

    async def search(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """Search for similar documents.

        If HTTP connection fails, automatically falls back to persistent mode and retries.
        Periodically checks if HTTP becomes available again when in fallback mode.
        """
        # Try to reconnect to HTTP if we're in fallback mode
        self._try_reconnect_http()

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

        # Search with automatic fallback on connection errors
        max_attempts = 2  # Try once, fallback once
        last_error = None

        for attempt in range(max_attempts):
            mode = "HTTP" if self._use_http else "Persistent"
            logger.info(f"🔍 ChromaVectorStore.search [{mode}] (attempt {attempt + 1}): query length={len(query)}, top_k={top_k}, filters={where}")

            try:
                # Check collection count first (this also tests connection)
                doc_count = self.collection.count()
                logger.info(f"   Collection: {self.collection_name}, Collection count: {doc_count}")

                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=top_k,
                    where=where,
                    include=["documents", "metadatas", "distances"],
                )

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
                    logger.info(f"   Collection has {doc_count} documents total")

                logger.info(f"📊 Returning {len(search_results)} search results")
                return search_results

            except Exception as e:
                last_error = e
                logger.error(f"❌ Search error (attempt {attempt + 1}): {e}")

                # Check if this is a connection error and we can fallback
                if self._use_http and self._is_connection_error(e) and attempt < max_attempts - 1:
                    logger.warning("Connection error detected - triggering fallback to persistent mode")
                    self._fallback_to_persistent()
                    continue  # Retry with persistent client
                else:
                    # Non-connection error or already in persistent mode
                    logger.error(f"❌ Search failed: {e}", exc_info=True)
                    break

        return []

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
            self._collection = None  # Reset collection cache
            # Recreate collection (get_or_create handles both HTTP and persistent modes)
            self._collection = self.client.get_or_create_collection(
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
            if self._use_http:
                # HTTP mode doesn't have list_collections in wrapper yet, return current collection
                return [self.collection_name]
            else:
                collections = self.client.list_collections()
                return [c.name for c in collections]
        except Exception:
            return []

    def get_connection_info(self) -> Dict[str, Any]:
        """Get information about the current ChromaDB connection."""
        # Trigger client initialization if not done
        _ = self.client
        return {
            "mode": "HTTP" if self._use_http else "Persistent",
            "collection": self.collection_name,
            "host": self.chroma_host if self._use_http else None,
            "port": self.chroma_port if self._use_http else None,
            "persist_directory": self.persist_directory if not self._use_http else None,
        }
