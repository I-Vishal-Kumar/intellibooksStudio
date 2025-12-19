"""RAG Query Engine - combines retrieval with LLM generation."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import logging

from ..retriever import SemanticRetriever, RetrievalResult
from ..config import get_settings

logger = logging.getLogger(__name__)


class RAGResponse(BaseModel):
    """Response from RAG query."""
    answer: str
    sources: List[Dict[str, Any]]
    query: str
    confidence: float
    retrieval_stats: Dict[str, Any]


class RAGQueryEngine:
    """RAG Query Engine that combines retrieval with LLM generation."""

    def __init__(
        self,
        retriever: SemanticRetriever,
        llm_provider: str = "openrouter",
    ):
        self.retriever = retriever
        self.settings = get_settings()
        self.llm = self._create_llm(llm_provider)

        self.qa_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful AI assistant that answers questions based on audio transcripts and their analysis.

Use the provided context to answer the user's question. If the context doesn't contain enough information to answer the question, say so honestly.

Guidelines:
- Be concise and direct
- Quote relevant parts of the transcript when appropriate
- Mention which transcript(s) the information comes from
- If multiple transcripts are relevant, synthesize the information"""),
            ("human", """Context from transcripts:
{context}

Question: {question}

Answer:"""),
        ])

        self.chain = self.qa_prompt | self.llm | StrOutputParser()

    def _create_llm(self, provider: str):
        """Create LLM based on provider."""
        if provider == "openai":
            return ChatOpenAI(
                model="gpt-4o",
                api_key=self.settings.openai_api_key,
                temperature=0.3,
            )
        elif provider == "anthropic":
            return ChatAnthropic(
                model="claude-sonnet-4-20250514",
                api_key=self.settings.anthropic_api_key,
                temperature=0.3,
            )
        else:  # openrouter
            return ChatOpenAI(
                model=self.settings.openrouter_model,
                api_key=self.settings.openrouter_api_key,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.3,
            )

    async def query(
        self,
        question: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> RAGResponse:
        """
        Process a RAG query.

        Args:
            question: The user's question
            top_k: Number of chunks to retrieve
            filters: Optional metadata filters

        Returns:
            RAGResponse with answer and sources
        """
        # Retrieve relevant chunks
        retrieval_result = await self.retriever.retrieve(
            query=question,
            top_k=top_k,
            filters=filters,
        )

        if not retrieval_result.chunks:
            return RAGResponse(
                answer="I couldn't find any relevant information in the transcripts to answer your question.",
                sources=[],
                query=question,
                confidence=0.0,
                retrieval_stats={"chunks_found": 0},
            )

        # Build context from retrieved chunks
        context_parts = []
        sources = []
        for chunk in retrieval_result.chunks:
            context_parts.append(f"[Transcript {chunk.metadata.get('transcript_id', 'unknown')}]\n{chunk.content}")
            sources.append({
                "transcript_id": chunk.metadata.get("transcript_id"),
                "chunk_id": chunk.id,
                "score": chunk.score,
                "preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
            })

        context = "\n\n---\n\n".join(context_parts)

        # Generate answer
        answer = await self.chain.ainvoke({
            "context": context,
            "question": question,
        })

        # Calculate confidence based on retrieval scores
        avg_score = sum(c.score for c in retrieval_result.chunks) / len(retrieval_result.chunks)

        return RAGResponse(
            answer=answer,
            sources=sources,
            query=question,
            confidence=avg_score,
            retrieval_stats={
                "chunks_found": len(retrieval_result.chunks),
                "avg_score": avg_score,
                "filters_applied": filters,
            },
        )

    async def query_with_chat_history(
        self,
        question: str,
        chat_history: List[Dict[str, str]],
        top_k: int = 5,
    ) -> RAGResponse:
        """Query with chat history for context."""
        # Build history context
        history_text = "\n".join([
            f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
            for msg in chat_history[-5:]  # Last 5 messages
        ])

        # Enhance question with history context
        enhanced_question = f"Given this conversation:\n{history_text}\n\nNew question: {question}"

        return await self.query(enhanced_question, top_k)

    async def compare_transcripts(
        self,
        transcript_ids: List[str],
        aspect: str = "content",
    ) -> RAGResponse:
        """Compare multiple transcripts."""
        comparison_prompt = f"Compare the following transcripts focusing on {aspect}. Highlight similarities and differences."

        return await self.query(
            comparison_prompt,
            filters={"transcript_id": transcript_ids},
        )
