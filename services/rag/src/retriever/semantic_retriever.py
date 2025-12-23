"""Semantic Retriever for RAG pipeline."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging

from ..vector_store import ChromaVectorStore, SearchResult

logger = logging.getLogger(__name__)


class RetrievalResult(BaseModel):
    """Result from semantic retrieval."""
    chunks: List[SearchResult]
    query: str
    total_results: int
    filters_applied: Optional[Dict[str, Any]] = None


class SemanticRetriever:
    """Retrieves semantically similar content from the vector store."""

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        default_top_k: int = 5,
        min_score_threshold: float = 0.5,
    ):
        self.vector_store = vector_store
        self.default_top_k = default_top_k
        self.min_score_threshold = min_score_threshold

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
        min_score: Optional[float] = None,
    ) -> RetrievalResult:
        """
        Retrieve relevant chunks for a query.

        Args:
            query: The search query
            top_k: Number of results to return
            filters: Metadata filters
            min_score: Minimum similarity score threshold

        Returns:
            RetrievalResult with matching chunks
        """
        k = top_k or self.default_top_k
        threshold = min_score or self.min_score_threshold

        logger.info(f"🔍 SemanticRetriever.retrieve: query='{query}', top_k={k}, threshold={threshold}, filters={filters}")

        # Search vector store
        results = await self.vector_store.search(
            query=query,
            top_k=k * 2,  # Get more results for filtering
            filters=filters,
        )

        logger.info(f"📊 Vector store search returned {len(results)} results (before filtering)")

        # Filter by score threshold
        filtered_results = [r for r in results if r.score >= threshold][:k]

        logger.info(f"✅ After filtering (threshold={threshold}): {len(filtered_results)} chunks")
        
        if filtered_results:
            logger.info("📋 Retrieved chunks:")
            for i, result in enumerate(filtered_results, 1):
                logger.info(f"   [{i}] ID: {result.id}, Score: {result.score:.4f}, Metadata: {result.metadata}")
        else:
            logger.warning(f"⚠️  No chunks passed the score threshold ({threshold})")
            if results:
                logger.info(f"   Top result score: {results[0].score:.4f} (below threshold)")

        return RetrievalResult(
            chunks=filtered_results,
            query=query,
            total_results=len(filtered_results),
            filters_applied=filters,
        )

    async def retrieve_by_transcript(
        self,
        query: str,
        transcript_ids: List[str],
        top_k: Optional[int] = None,
    ) -> RetrievalResult:
        """Retrieve from specific transcripts."""
        return await self.retrieve(
            query=query,
            top_k=top_k,
            filters={"transcript_id": transcript_ids},
        )

    async def retrieve_by_language(
        self,
        query: str,
        language: str,
        top_k: Optional[int] = None,
    ) -> RetrievalResult:
        """Retrieve from transcripts in a specific language."""
        return await self.retrieve(
            query=query,
            top_k=top_k,
            filters={"language": language},
        )

    async def hybrid_retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        include_summaries: bool = True,
        include_transcripts: bool = True,
    ) -> RetrievalResult:
        """
        Hybrid retrieval combining different document types.
        """
        all_results = []
        k = top_k or self.default_top_k

        # Retrieve from transcripts
        if include_transcripts:
            transcript_results = await self.vector_store.search(
                query=query,
                top_k=k,
                filters={"type": None},  # Transcripts don't have type field
            )
            all_results.extend(transcript_results)

        # Retrieve from summaries
        if include_summaries:
            summary_results = await self.vector_store.search(
                query=query,
                top_k=k,
                filters={"type": "summary"},
            )
            all_results.extend(summary_results)

            # Also get key points
            keypoint_results = await self.vector_store.search(
                query=query,
                top_k=k,
                filters={"type": "key_point"},
            )
            all_results.extend(keypoint_results)

        # Deduplicate and sort by score
        seen_ids = set()
        unique_results = []
        for result in sorted(all_results, key=lambda x: x.score, reverse=True):
            if result.id not in seen_ids:
                seen_ids.add(result.id)
                unique_results.append(result)

        return RetrievalResult(
            chunks=unique_results[:k],
            query=query,
            total_results=len(unique_results[:k]),
        )
