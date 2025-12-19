"""Document Indexer for RAG pipeline."""

from typing import List, Optional, Dict, Any
from langchain.text_splitter import RecursiveCharacterTextSplitter
import logging
import uuid

from ..vector_store import ChromaVectorStore, Document

logger = logging.getLogger(__name__)


class DocumentIndexer:
    """Indexes documents for RAG retrieval."""

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ):
        self.vector_store = vector_store
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    async def index_transcript(
        self,
        transcript_id: str,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """
        Index a transcript for RAG retrieval.

        Args:
            transcript_id: The transcript's database ID
            text: The transcript text
            metadata: Additional metadata

        Returns:
            List of chunk IDs
        """
        # Split text into chunks
        chunks = self.text_splitter.split_text(text)

        # Create documents for each chunk
        documents = []
        for i, chunk in enumerate(chunks):
            doc_id = f"{transcript_id}_chunk_{i}"
            doc_metadata = {
                "transcript_id": transcript_id,
                "chunk_index": i,
                "total_chunks": len(chunks),
                **(metadata or {}),
            }
            documents.append(Document(
                id=doc_id,
                content=chunk,
                metadata=doc_metadata,
            ))

        # Add to vector store
        ids = await self.vector_store.add_documents(documents)
        logger.info(f"Indexed transcript {transcript_id} into {len(chunks)} chunks")
        return ids

    async def index_summary(
        self,
        summary_id: str,
        transcript_id: str,
        summary_text: str,
        key_points: List[str],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        """Index a summary and its key points."""
        documents = []

        # Index the full summary
        documents.append(Document(
            id=f"summary_{summary_id}",
            content=summary_text,
            metadata={
                "type": "summary",
                "summary_id": summary_id,
                "transcript_id": transcript_id,
                **(metadata or {}),
            },
        ))

        # Index each key point
        for i, point in enumerate(key_points):
            documents.append(Document(
                id=f"summary_{summary_id}_keypoint_{i}",
                content=point,
                metadata={
                    "type": "key_point",
                    "summary_id": summary_id,
                    "transcript_id": transcript_id,
                    "point_index": i,
                    **(metadata or {}),
                },
            ))

        ids = await self.vector_store.add_documents(documents)
        logger.info(f"Indexed summary {summary_id} with {len(key_points)} key points")
        return ids

    async def delete_transcript(self, transcript_id: str) -> bool:
        """Delete all chunks for a transcript."""
        # Get all chunk IDs for this transcript
        # This is a simplified approach - in production, you'd query by metadata
        chunk_ids = [f"{transcript_id}_chunk_{i}" for i in range(100)]
        return await self.vector_store.delete_documents(chunk_ids)

    async def reindex_all(self, transcripts: List[Dict[str, Any]]) -> int:
        """Reindex all transcripts."""
        await self.vector_store.clear()

        total_chunks = 0
        for transcript in transcripts:
            ids = await self.index_transcript(
                transcript_id=str(transcript["id"]),
                text=transcript["text"],
                metadata={
                    "language": transcript.get("language"),
                    "created_at": str(transcript.get("created_at")),
                },
            )
            total_chunks += len(ids)

        logger.info(f"Reindexed {len(transcripts)} transcripts into {total_chunks} chunks")
        return total_chunks
