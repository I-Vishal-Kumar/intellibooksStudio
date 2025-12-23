"""Research Agent - Intelligent research agent using LangChain Deep Agents with RAG."""

from typing import Optional, Any, Dict, List
from pathlib import Path
import logging
import sys
import os

# Import Deep Agents
try:
    from deepagents import create_deep_agent
    DEEP_AGENTS_AVAILABLE = True
except ImportError:
    try:
        # Try alternative import
        project_root = Path(__file__).parent.parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from deepagents import create_deep_agent
        DEEP_AGENTS_AVAILABLE = True
    except ImportError as e:
        logging.warning(f"Deep Agents not available: {e}. Install with: pip install deepagents")
        DEEP_AGENTS_AVAILABLE = False
        create_deep_agent = None

# Import RAG components
try:
    from services.rag.src.vector_store import ChromaVectorStore
    from services.rag.src.retriever import SemanticRetriever
    from services.rag.src.query_engine import RAGQueryEngine
    RAG_AVAILABLE = True
except ImportError:
    try:
        # Try alternative import path
        project_root = Path(__file__).parent.parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from services.rag.src.vector_store import ChromaVectorStore
        from services.rag.src.retriever import SemanticRetriever
        from services.rag.src.query_engine import RAGQueryEngine
        RAG_AVAILABLE = True
    except ImportError as e:
        logging.warning(f"RAG components not available: {e}")
        RAG_AVAILABLE = False
        ChromaVectorStore = None
        SemanticRetriever = None
        RAGQueryEngine = None

# Import BaseAgent - ensure path is set
_agent_framework_path = str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src")
if _agent_framework_path not in sys.path:
    sys.path.insert(0, _agent_framework_path)

try:
    from identity.card import Skill, TrustLevel, ActionType
    from base.agent import BaseAgent, AgentResult, AgentContext
    BASE_AGENT_AVAILABLE = True
except ImportError:
    try:
        # Fallback to alternative import path
        from identity import Skill, TrustLevel, ActionType
        from base import BaseAgent, AgentResult, AgentContext
        BASE_AGENT_AVAILABLE = True
    except ImportError:
        BASE_AGENT_AVAILABLE = False
        BaseAgent = None
        AgentResult = None
        AgentContext = None

from ..llm_factory import create_llm_settings

logger = logging.getLogger(__name__)


# Global RAG engine instance
_rag_engine = None


def get_rag_engine():
    """Get or create the global RAG engine instance."""
    global _rag_engine
    if _rag_engine is None and RAG_AVAILABLE:
        try:
            # Get collection name from RAG config to match what the RAG service uses
            from services.rag.src.config import get_settings
            from pathlib import Path
            import os
            
            rag_settings = get_settings()
            collection_name = rag_settings.chroma_collection  # Use same collection as RAG service
            
            logger.info(f"Initializing RAG engine with collection: {collection_name}")
            
            # Initialize vector store with the same collection name as RAG service
            # Use the same persist directory logic as RAG pipeline
            persist_dir = os.getenv("CHROMA_PERSIST_DIRECTORY")
            if not persist_dir:
                persist_dir = str(Path(__file__).parent.parent.parent.parent.parent / "data" / "chroma_db")
            
            vector_store = ChromaVectorStore(
                collection_name=collection_name,
                embedding_model=rag_settings.embedding_model,
                persist_directory=persist_dir,
            )
            
            logger.info(f"Vector store initialized: collection={collection_name}, persist_dir={persist_dir}")
            
            # Check collection count for debugging
            try:
                import asyncio
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If loop is running, we need to use a thread
                    import concurrent.futures
                    def get_count():
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        try:
                            return new_loop.run_until_complete(vector_store.count())
                        finally:
                            new_loop.close()
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(get_count)
                        count = future.result(timeout=5)
                else:
                    count = loop.run_until_complete(vector_store.count())
                logger.info(f"Collection '{collection_name}' has {count} documents")
            except Exception as e:
                logger.warning(f"Could not check collection count: {e}")
            
            # Initialize retriever with lower threshold to get more results
            # Lower threshold allows more chunks to pass through for better coverage
            retriever = SemanticRetriever(
                vector_store=vector_store,
                default_top_k=5,
                min_score_threshold=0.3,  # Lowered from 0.5 to capture more relevant results
            )
            
            # Initialize RAG query engine
            _rag_engine = RAGQueryEngine(
                retriever=retriever,
                llm_provider=rag_settings.default_llm_provider,
            )
            
            logger.info("RAG engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize RAG engine: {e}", exc_info=True)
            _rag_engine = None
    
    return _rag_engine


def knowledge_search(
    query: str,
    top_k: int = 5,
    filters: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Search the knowledge base using RAG.
    
    Args:
        query: The search query
        top_k: Number of results to return (default: 5)
        filters: Optional metadata filters (e.g., {"transcript_id": "123"})
    
    Returns:
        Dictionary with answer, sources, and metadata
    """
    logger.info(f"🔍 Knowledge search called with query: '{query}', top_k: {top_k}, filters: {filters}")
    
    rag_engine = get_rag_engine()
    
    if not rag_engine:
        logger.error("❌ RAG engine not initialized - knowledge base unavailable")
        return {
            "answer": "Knowledge base is currently unavailable.",
            "sources": [],
            "error": "RAG engine not initialized",
        }
    
    try:
        import asyncio
        
        # Deep agents tools are synchronous, so we need to run async code
        # Try to get existing event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, we need to use a thread
                import concurrent.futures
                import threading
                
                # Create a new event loop in a thread
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(
                            rag_engine.query(query, top_k=top_k, filters=filters)
                        )
                    finally:
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    rag_response = future.result(timeout=30)
            else:
                rag_response = loop.run_until_complete(
                    rag_engine.query(query, top_k=top_k, filters=filters)
                )
        except RuntimeError:
            # No event loop, create a new one
            rag_response = asyncio.run(
                rag_engine.query(query, top_k=top_k, filters=filters)
            )
        
        # Log retrieval results
        logger.info(f"✅ Knowledge search completed")
        logger.info(f"   📊 Confidence: {rag_response.confidence:.2f}")
        logger.info(f"   📚 Sources found: {len(rag_response.sources)}")
        logger.info(f"   📈 Retrieval stats: {rag_response.retrieval_stats}")
        
        if rag_response.sources:
            logger.info("   📋 Retrieved sources:")
            for i, source in enumerate(rag_response.sources, 1):
                transcript_id = source.get("transcript_id", "unknown")
                score = source.get("score", 0.0)
                preview = source.get("preview", "")[:100]
                logger.info(f"      [{i}] Transcript: {transcript_id}, Score: {score:.3f}, Preview: {preview}...")
        else:
            logger.warning("   ⚠️  No sources retrieved from knowledge base")
        
        return {
            "answer": rag_response.answer,
            "sources": rag_response.sources,
            "confidence": rag_response.confidence,
            "retrieval_stats": rag_response.retrieval_stats,
        }
    except Exception as e:
        logger.error(f"❌ Knowledge search failed: {e}", exc_info=True)
        return {
            "answer": f"Error searching knowledge base: {str(e)}",
            "sources": [],
            "error": str(e),
        }


def query_knowledge_base(
    question: str,
    max_results: int = 5,
) -> str:
    """
    Query the knowledge base and return a formatted answer with sources.
    
    Args:
        question: The research question
        max_results: Maximum number of sources to include
    
    Returns:
        Formatted string with answer and source citations
    """
    result = knowledge_search(question, top_k=max_results)
    
    if result.get("error"):
        return result["answer"]
    
    # Format response with sources
    response_parts = [result["answer"]]
    
    if result.get("sources"):
        response_parts.append("\n\n--- Sources ---")
        for i, source in enumerate(result["sources"][:max_results], 1):
            transcript_id = source.get("transcript_id", "unknown")
            score = source.get("score", 0.0)
            preview = source.get("preview", "")
            response_parts.append(
                f"\n[{i}] Transcript: {transcript_id} (Relevance: {score:.2f})\n   {preview}"
            )
    
    return "\n".join(response_parts)


class ResearchAgent(BaseAgent):
    """Research Agent using LangChain Deep Agents with RAG integration."""

    def __init__(self):
        if not DEEP_AGENTS_AVAILABLE:
            raise ImportError(
                "Deep Agents not available. Install with: pip install deepagents"
            )
        
        if not BASE_AGENT_AVAILABLE:
            raise ImportError(
                "BaseAgent not available. Cannot initialize ResearchAgent without BaseAgent."
            )
        
        # Get LLM settings
        llm_settings = create_llm_settings()
        
        # Define skills for the research agent
        skills = [
            Skill(
                name="research",
                confidence_score=0.90,
                input_types=["text/plain"],
                output_types=["text/plain", "application/json"],
                description="Conduct thorough research using knowledge base and provide comprehensive, well-cited answers",
            ),
            Skill(
                name="knowledge_base_query",
                confidence_score=0.85,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Query knowledge base using RAG for information retrieval with source citations",
            ),
            Skill(
                name="synthesis",
                confidence_score=0.88,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Synthesize information from multiple sources into coherent, well-structured responses",
            ),
        ]
        
        # Initialize BaseAgent with identity card
        super().__init__(
            name="research-agent",
            agent_type="research",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            domain="research",
            llm_settings=llm_settings,
            default_temperature=0.3,  # Research agents benefit from lower temperature for accuracy
        )
        
        # System prompt for the research agent
        research_instructions = """You are an expert research assistant for the Audio Insight Platform. 
Your job is to conduct thorough research using all available knowledge sources and then provide comprehensive, well-cited answers.

## Available Tools

### `knowledge_search`
Use this to search the knowledge base for information. This tool searches through:
- Audio transcripts and their analysis
- Historical interactions and patterns
- Domain-specific knowledge bases

Parameters:
- query: Your search query
- top_k: Number of results to return (default: 5)
- filters: Optional filters (e.g., {"transcript_id": "123"})

### `query_knowledge_base`
Use this for direct questions. It will search the knowledge base and return a formatted answer with source citations.

## Guidelines

1. **Planning**: Use the built-in `write_todos` tool to break down complex research tasks
2. **Research**: Always search the knowledge base first before answering
3. **Synthesis**: Combine information from multiple sources when relevant
4. **Citation**: Always cite your sources when presenting information
5. **Honesty**: If information is not available in the knowledge base, clearly state this
6. **Organization**: Structure your responses clearly with sections when appropriate
7. **File Management**: Use filesystem tools (`write_file`, `read_file`) to manage large research results

## Workflow

For complex research queries:
1. Plan your approach using `write_todos`
2. Search the knowledge base using `knowledge_search` or `query_knowledge_base`
3. If needed, save intermediate results to files
4. Synthesize findings into a comprehensive answer
5. Include all relevant source citations

Remember: Your goal is to provide accurate, well-researched answers with proper source attribution."""

        # Create tools list
        tools = [knowledge_search, query_knowledge_base]
        
        # Create the model instance based on provider
        try:
            from langchain_openai import ChatOpenAI
            from langchain_anthropic import ChatAnthropic
            
            provider = llm_settings.get("provider", "openrouter")
            api_key = llm_settings.get("api_key", "")
            model_name = llm_settings.get("model", "anthropic/claude-sonnet-4")
            
            if not api_key:
                raise ValueError(f"API key not configured for provider: {provider}")
            
            # Create model instance
            if provider == "openai":
                model = ChatOpenAI(
                    model=model_name,
                    api_key=api_key,
                    temperature=0.3,
                )
            elif provider == "anthropic":
                model = ChatAnthropic(
                    model=model_name,
                    api_key=api_key,
                    temperature=0.3,
                )
            else:  # openrouter
                model = ChatOpenAI(
                    model=model_name,
                    api_key=api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.3,
                )
            
            # Create deep agent with model
            self.deep_agent = create_deep_agent(
                model=model,
                tools=tools,
                system_prompt=research_instructions,
            )
            self.logger.info("Deep Agent research agent initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to create deep agent: {e}")
            raise

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Execute research query using Deep Agent.

        Args:
            input_data: Dict with 'query', 'question', 'message', or 'text'
            context: Optional execution context

        Returns:
            AgentResult with research response
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)
        
        try:
            # Extract query from input
            query = (
                input_data.get("query")
                or input_data.get("question")
                or input_data.get("message")
                or input_data.get("text", "")
            )
            
            if not query:
                result.error = "No research query provided"
                result.mark_complete()
                return result

            # Invoke deep agent
            # Deep agents use LangGraph format: {"messages": [{"role": "user", "content": query}]}
            # Note: invoke() is synchronous, but we're in an async function
            # We'll run it in a thread to avoid blocking
            import asyncio
            import concurrent.futures
            
            def run_agent():
                return self.deep_agent.invoke({
                    "messages": [{"role": "user", "content": query}]
                })
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                agent_result = await loop.run_in_executor(executor, run_agent)

            # Log agent result structure for debugging
            self.logger.info(f"📊 Deep agent result structure: {type(agent_result)}")
            if isinstance(agent_result, dict):
                self.logger.info(f"   Keys: {list(agent_result.keys())}")
                # Log first few messages to understand structure
                if "messages" in agent_result:
                    self.logger.info(f"   Messages count: {len(agent_result['messages'])}")
                    for i, msg in enumerate(agent_result["messages"][:3]):
                        self.logger.info(f"   Message {i}: type={type(msg)}, keys={list(msg.keys()) if isinstance(msg, dict) else 'N/A'}")

            # Extract response from agent result
            # Deep agents return messages in the result
            messages = agent_result.get("messages", []) if isinstance(agent_result, dict) else []
            if messages:
                last_message = messages[-1]
                # Handle both dict and object-style messages
                if isinstance(last_message, dict):
                    response_content = last_message.get("content", "")
                else:
                    response_content = getattr(last_message, "content", "")
            else:
                response_content = "No response generated"

            # Try to extract sources from tool calls in the agent result
            # Deep agents may include tool calls in the messages
            sources = []
            confidence = 0.0
            
            # Look for tool calls in messages that might contain RAG results
            # Deep agents store tool calls and results in the message history
            for i, msg in enumerate(messages):
                msg_dict = msg if isinstance(msg, dict) else msg.__dict__ if hasattr(msg, "__dict__") else {}
                
                # Check for tool_calls (when agent calls a tool)
                tool_calls = msg_dict.get("tool_calls", [])
                if tool_calls:
                    self.logger.info(f"   Message {i}: Found {len(tool_calls)} tool calls")
                    for tc in tool_calls:
                        self.logger.info(f"      Tool call: {tc.get('name', 'unknown') if isinstance(tc, dict) else 'N/A'}")
                
                # Check for tool message content (tool results)
                # Tool results might be in a separate message with role="tool"
                if msg_dict.get("role") == "tool" or "tool" in str(msg_dict.get("type", "")).lower():
                    content = msg_dict.get("content", "")
                    self.logger.info(f"   Message {i}: Tool result found, content type: {type(content)}")
                    # Try to parse JSON if content is a string
                    if isinstance(content, str):
                        try:
                            import json
                            content = json.loads(content)
                        except:
                            pass
                    
                    if isinstance(content, dict):
                        if "sources" in content:
                            new_sources = content["sources"] if isinstance(content["sources"], list) else []
                            sources.extend(new_sources)
                            self.logger.info(f"      Found {len(new_sources)} sources in tool result")
                        if "confidence" in content:
                            conf = content["confidence"]
                            if conf > confidence:
                                confidence = conf
                        if "retrieval_stats" in content:
                            self.logger.info(f"      Retrieval stats: {content['retrieval_stats']}")
            
            # Deduplicate sources by chunk_id to avoid showing the same chunk multiple times
            # The deep agent may call knowledge_search multiple times, retrieving overlapping results
            original_count = len(sources)
            seen_chunk_ids = set()
            deduplicated_sources = []
            for source in sources:
                chunk_id = source.get("chunk_id") or source.get("id")
                if chunk_id and chunk_id not in seen_chunk_ids:
                    seen_chunk_ids.add(chunk_id)
                    deduplicated_sources.append(source)
                elif not chunk_id:
                    # If no chunk_id, use content preview as fallback deduplication key
                    content_preview = source.get("preview", "")[:100]
                    if content_preview not in seen_chunk_ids:
                        seen_chunk_ids.add(content_preview)
                        deduplicated_sources.append(source)
            
            # Sort by score (highest first) and limit to top results
            deduplicated_sources.sort(key=lambda x: x.get("score", 0.0), reverse=True)
            sources = deduplicated_sources[:10]  # Limit to top 10 unique sources
            
            # If no sources found in tool results, try to extract from knowledge_search calls
            # We'll also log what we found
            self.logger.info(f"📊 Agent result analysis:")
            self.logger.info(f"   Messages count: {len(messages)}")
            self.logger.info(f"   Sources found in tool results (before dedup): {original_count}")
            self.logger.info(f"   Sources after deduplication: {len(sources)}")
            if original_count > len(sources):
                self.logger.info(f"   Removed {original_count - len(sources)} duplicate sources")
            
            # If still no sources, try calling knowledge_search directly to get sources
            if not sources:
                self.logger.info("🔍 No sources in tool results, calling knowledge_search directly to get sources...")
                try:
                    search_result = knowledge_search(query, top_k=5)
                    if search_result.get("sources"):
                        sources = search_result["sources"]
                        confidence = search_result.get("confidence", 0.0)
                        self.logger.info(f"✅ Retrieved {len(sources)} sources directly from knowledge_search")
                        self.logger.info(f"   Confidence: {confidence:.4f}")
                except Exception as e:
                    self.logger.warning(f"⚠️  Failed to get sources directly: {e}")

            # Build response data
            response_data = {
                "response": response_content,
                "answer": response_content,
                "query": query,
                "sources": sources,
                "confidence": confidence,
            }
            
            self.logger.info(f"📤 Final response data: {len(sources)} sources, confidence: {confidence:.4f}")

            # Return AgentResult
            result.success = True
            result.data = response_data
            result.metadata = {
                "input_length": len(query),
                "response_length": len(response_content),
                "deep_agent_used": True,
                "sources_count": len(sources),
                "confidence": confidence,
            }
            result.mark_complete()
            return result

        except Exception as e:
            self.logger.exception("Research agent execution failed")
            result.error = str(e)
            result.mark_complete()
            return result

    async def safe_execute(self, input_data: Any, context: Optional[AgentContext] = None) -> AgentResult:
        """Safe execute wrapper that handles errors gracefully."""
        try:
            return await self.execute(input_data, context)
        except Exception as e:
            self.logger.exception("Error in safe_execute")
            result = AgentResult(success=False, agent_id=self.agent_id)
            result.error = str(e)
            result.mark_complete()
            return result
