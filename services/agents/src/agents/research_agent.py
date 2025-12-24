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
    from services.rag.src.rag_pipeline import ChromaDBStore, RAGConfig, load_config
    from services.rag.src.vector_store import ChromaVectorStore
    from services.rag.src.retriever import SemanticRetriever
    from services.rag.src.query_engine import RAGQueryEngine
    RAG_AVAILABLE = True
except ImportError:
    try:
        # Try alternative import path
        project_root = Path(__file__).parent.parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from services.rag.src.rag_pipeline import ChromaDBStore, RAGConfig, load_config
        from services.rag.src.retriever import SemanticRetriever
        from services.rag.src.query_engine import RAGQueryEngine
        RAG_AVAILABLE = True
    except ImportError as e:
        logging.warning(f"RAG components not available: {e}")
        RAG_AVAILABLE = False
        ChromaDBStore = None
        RAGConfig = None
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
from ..middleware import ComplianceMiddleware, GuardrailsMiddleware
from ..memory import MemoryManager

logger = logging.getLogger(__name__)


# Global RAG engine instance
_rag_engine = None


def get_rag_engine():
    """Get or create the global RAG engine instance."""
    global _rag_engine
    if _rag_engine is None and RAG_AVAILABLE:
        try:
            # Load RAG config - this will use environment variables
            # Priority: HTTP (Docker) first, then fallback to persistent (local)
            rag_config = load_config()
            
            # Ensure HTTP is tried first (Docker), then persistent as fallback
            # This is already the default in RAGConfig, but make it explicit
            if not rag_config.chroma_use_http:
                logger.info("CHROMA_USE_HTTP is False, but enabling it to try Docker first")
                rag_config.chroma_use_http = True
            
            collection_name = rag_config.chroma_collection
            logger.info(f"Initializing RAG engine with collection: {collection_name}")

            # Initialize vector store with the same collection name as RAG service
            # ChromaVectorStore now uses dual-mode (HTTP first, fallback to persistent)
            # This ensures research agent uses the SAME ChromaDB as RAG service
            vector_store = ChromaVectorStore(
                collection_name=collection_name,
                embedding_model=rag_config.embedding_model,
            )

            # Log connection info
            conn_info = vector_store.get_connection_info()
            logger.info(f"Vector store initialized: {conn_info}")
            
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
<<<<<<< Updated upstream
            # ChromaDB returns similarity scores typically in 0.05-0.3 range for good matches
=======
            # Lower threshold allows more chunks to pass through for better coverage
            # Note: SemanticRetriever expects ChromaVectorStore interface, but ChromaDBStore
            # implements the same search() method, so it's compatible
>>>>>>> Stashed changes
            retriever = SemanticRetriever(
                vector_store=vector_store,  # ChromaDBStore is compatible with ChromaVectorStore interface
                default_top_k=5,
                min_score_threshold=0.05,  # Lowered to 0.05 - ChromaDB similarity scores are typically low
            )
            
            # Get LLM provider from config
            from services.rag.src.config import get_settings
            rag_settings = get_settings()
            
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
        import concurrent.futures
        
        # Deep agents tools are synchronous, so we need to run async code
        # Always run in a new thread with its own event loop to avoid conflicts
        def run_in_thread():
            """Run async code in a new thread with its own event loop."""
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(
                    rag_engine.query(query, top_k=top_k, filters=filters)
                )
            finally:
                new_loop.close()
        
        # Execute in thread pool to avoid event loop conflicts
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_thread)
            rag_response = future.result(timeout=30)
        
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

    def __init__(self, session_id: Optional[str] = None, enable_memory: bool = True):
        if not DEEP_AGENTS_AVAILABLE:
            raise ImportError(
                "Deep Agents not available. Install with: pip install deepagents"
            )
        
        if not BASE_AGENT_AVAILABLE:
            raise ImportError(
                "BaseAgent not available. Cannot initialize ResearchAgent without BaseAgent."
            )
        
        # Store session_id for memory isolation
        self.session_id = session_id or "default"
        self.enable_memory = enable_memory
        self.memory_manager = None  # Will be initialized if memory is enabled
        
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

### Filesystem Tools (AUTOMATICALLY AVAILABLE)
You have access to these filesystem tools that work with `/memories/`:
- `ls(path)`: List files in a directory (e.g., `ls("/memories/")`)
- `glob(pattern)`: Find files matching a pattern (e.g., `glob("/memories/*vishal*")`)
- `read_file(path)`: Read a file (e.g., `read_file("/memories/vishal_kumar_skills.json")`)
- `write_file(path, content)`: Write content to a file
- `edit_file(path, edits)`: Edit a file
- `grep(pattern, path)`: Search for text in files

**CRITICAL**: When a user asks about stored information or memory, you MUST use these filesystem tools first!

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

## Long-Term Memory

You have access to persistent long-term memory at `/memories/`:
- **IMPORTANT**: Always use absolute paths starting with `/memories/` for persistent storage
- Save interaction history: `write_file("/memories/session_{session_id}/interaction_history.json", ...)`
- Save research findings: `write_file("/memories/session_{session_id}/research_findings.md", ...)`
- Save user information: `write_file("/memories/session_{session_id}/user_info.json", ...)`
- Save patterns: `write_file("/memories/patterns/{pattern_name}.json", ...)`
- Read previous data: `read_file("/memories/session_{session_id}/interaction_history.json")`

**Path Rules**:
- Use absolute paths: `/memories/...` (not relative paths)
- Files under `/memories/` persist across sessions
- Files under `/workspace/` are temporary (ephemeral)

## Workflow

For complex research queries:
1. **Check Memory First**: If the query mentions stored information, previous research, or asks about memory, use filesystem tools to check `/memories/`:
   - Use `ls("/memories/")` or `glob("/memories/*vishal*")` to find relevant files
   - Use `read_file("/memories/filename.json")` to read stored data
2. Plan your approach using `write_todos`
3. Search the knowledge base using `knowledge_search` or `query_knowledge_base` if memory doesn't have the answer
4. If needed, save intermediate results to files using absolute paths under `/memories/`
5. Synthesize findings into a comprehensive answer
6. Include all relevant source citations
7. Save important findings to long-term memory at `/memories/` using absolute paths

**CRITICAL INSTRUCTIONS FOR MEMORY ACCESS**:

When a user asks about stored information, memory, or previously saved data:
1. **IMMEDIATELY** use `glob("/memories/*keyword*")` or `ls("/memories/")` to find relevant files
2. **THEN** use `read_file("/memories/filename.json")` to read the stored data
3. **ONLY AFTER** checking memory, use `knowledge_search` if additional information is needed

Example workflow for "check our memory of vishal kumar":
1. Call `glob("/memories/*vishal*")` to find files
2. Call `read_file("/memories/vishal_kumar_skills.json")` to read the data
3. Synthesize the information from the memory files
4. If needed, supplement with `knowledge_search` for additional context

**DO NOT skip memory access when the user explicitly asks about stored information!**

Remember: Your goal is to provide accurate, well-researched answers with proper source attribution."""

        # Create tools list
        tools = [knowledge_search, query_knowledge_base]
        
        # Create compliance middleware
        compliance_middleware = ComplianceMiddleware(
            strict_mode=True,
            log_violations=True,
        )
        
        # Create guardrails middleware for safety checks
        guardrails_middleware = GuardrailsMiddleware(
            detect_pii=True,
            pii_types=["email", "credit_card", "ip", "api_key", "phone", "ssn"],
            pii_strategy="redact",  # Redact PII instead of blocking
            detect_prompt_injection=True,
            detect_toxic_content=True,
            banned_keywords=["hack", "exploit", "malware", "virus"],  # Add domain-specific banned keywords
            use_model_safety_check=False,  # Set to True to use LLM for safety checks (slower)
            block_on_violation=True,
            log_violations=True,
        )
        
        # Create memory backend if enabled using deepagents built-in backends
        backend = None
        if self.enable_memory:
            try:
                # Import deepagents built-in backends
                from deepagents.backends import StateBackend, FilesystemBackend, CompositeBackend
                
                # Get absolute path for memories directory
                project_root = Path(__file__).parent.parent.parent.parent.parent
                memories_dir = project_root / "data" / "memories"
                memories_dir.mkdir(parents=True, exist_ok=True)
                memories_absolute_path = str(memories_dir.absolute())
                
                # Create composite backend:
                # - Default: StateBackend (ephemeral, for /workspace/)
                # - /memories/: FilesystemBackend (persistent, on disk)
                # FilesystemBackend doesn't need runtime, so we can create it directly
                # But CompositeBackend routes need to be created per runtime
                def create_backend(runtime):
                    return CompositeBackend(
                        default=StateBackend(runtime),
                        routes={
                            "/memories/": FilesystemBackend(
                                root_dir=memories_absolute_path,
                                virtual_mode=True,  # Sandbox and normalize paths
                            ),
                        }
                    )
                
                backend = create_backend
                
                # Initialize memory manager for explicit memory operations
                # Note: MemoryManager is now optional since agent can use filesystem tools directly
                # We'll disable it for now since backend is managed by deepagents runtime
                self.memory_manager = None  # Agent will use filesystem tools to save to /memories/
                self.logger.info(f"Long-term memory enabled for session: {self.session_id}")
                self.logger.info(f"  - Using CompositeBackend: StateBackend (default) + FilesystemBackend (/memories/)")
                self.logger.info(f"  - FilesystemBackend root: {memories_absolute_path}")
                self.logger.info("  - Agent can use filesystem tools (write_file, read_file) to save/load from /memories/")
                self.logger.info("  - Files written to /memories/ will be saved to disk at the above path")
            except Exception as e:
                self.logger.warning(f"Failed to initialize memory backend: {e}. Continuing without memory.")
                backend = None
        
        # Define sub-agents for specialized tasks
        # These can be used by the main agent via the task() tool
        # Note: deepagents expects subagents as a list of dictionaries, not a dict
        subagents = [
            {
                "name": "deep-researcher",
                "description": "Specialized agent for deep research on specific topics",
                "system_prompt": """You are a specialized deep research agent. Your job is to conduct
thorough, detailed research on specific topics. Use the knowledge_search tool extensively
to gather comprehensive information before synthesizing your findings.""",
                "tools": [knowledge_search, query_knowledge_base],
            },
            {
                "name": "synthesis-agent",
                "description": "Specialized agent for synthesizing information from multiple sources",
                "system_prompt": """You are a synthesis specialist. Your job is to take information
from multiple sources and create coherent, well-structured summaries and analyses.
Focus on identifying patterns, connections, and key insights across sources.""",
                "tools": [query_knowledge_base],
            },
        ]
        
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
            
            # Create deep agent with model, middleware, subagents, and backend
            # Note: create_deep_agent automatically provides filesystem tools:
            # ls, read_file, write_file, edit_file, glob, grep, execute
            # These tools work with the backend we configure below
            create_kwargs = {
                "model": model,
                "tools": tools,  # Our custom tools (knowledge_search, query_knowledge_base)
                # Filesystem tools are automatically added by create_deep_agent
                "system_prompt": research_instructions,
                "middleware": [guardrails_middleware, compliance_middleware],  # Guardrails first, then compliance
            }
            
            # Add subagents if available (deepagents may support this)
            # Note: Check deepagents documentation for exact parameter name
            try:
                # Try with subagents parameter
                create_kwargs["subagents"] = subagents
            except Exception:
                # If subagents not supported, log and continue
                self.logger.debug("Subagents parameter not available in create_deep_agent")
            
            # Add backend if memory is enabled
            # deepagents expects backend as a factory function: lambda rt: Backend(rt)
            if backend is not None:
                try:
                    create_kwargs["backend"] = backend
                    # Note: FilesystemBackend doesn't need a store, only StoreBackend does
                    # So we don't need to provide store parameter here
                except Exception as e:
                    self.logger.warning(f"Backend parameter not available in create_deep_agent: {e}")
            
                # Create deep agent
                self.deep_agent = create_deep_agent(**create_kwargs)
                self.logger.info("Deep Agent research agent initialized successfully")
                self.logger.info(f"  - Middleware: GuardrailsMiddleware + ComplianceMiddleware enabled")
                self.logger.info(f"  - Memory: {'Enabled' if backend else 'Disabled'}")
                self.logger.info(f"  - Sub-agents: {len(subagents)} configured")
                self.logger.info(f"  - Custom tools: {[t.__name__ if hasattr(t, '__name__') else str(t) for t in tools]}")
                self.logger.info(f"  - Automatic filesystem tools: ls, read_file, write_file, edit_file, glob, grep, execute")
                if backend:
                    self.logger.info(f"  - Backend configured: Filesystem tools can access /memories/ for persistent storage")
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

            # Apply guardrails to input BEFORE invoking deep agent (same pattern as ChatAgent)
            from ..middleware import GuardrailsMiddleware
            from ..middleware.guardrails_middleware import GuardrailsBlockedException
            
            # Create guardrails middleware instance (same config as in __init__)
            guardrails = GuardrailsMiddleware(
                detect_pii=True,
                pii_types=["email", "credit_card", "ip", "api_key", "phone", "ssn"],
                pii_strategy="redact",
                detect_prompt_injection=True,
                detect_toxic_content=True,
                banned_keywords=["hack", "exploit", "malware", "virus"],
                use_model_safety_check=False,
                block_on_violation=True,
                log_violations=True,
            )
            
            input_state = {
                "messages": [{"role": "user", "content": query}]
            }
            
            try:
                guardrails_result = guardrails.before_model(input_state)
            except GuardrailsBlockedException as e:
                # Guardrails blocked the request - return blocking message immediately
                self.logger.warning(f"🚫 Request blocked by guardrails: {e.reason}")
                result.success = True
                result.data = {
                    "response": e.message,
                    "answer": e.message,
                    "query": query,
                    "sources": [],
                    "confidence": 0.0,
                }
                result.metadata = {
                    "input_length": len(query),
                    "response_length": len(e.message),
                    "deep_agent_used": False,  # Deep agent was never invoked
                    "sources_count": 0,
                    "confidence": 0.0,
                    "blocked_by_guardrails": True,
                    "block_reason": e.reason,
                }
                result.mark_complete()
                return result
            
            # Get potentially modified query (PII redacted, etc.)
            if guardrails_result and guardrails_result.get("messages"):
                modified_messages = guardrails_result["messages"]
                if modified_messages:
                    modified_msg = modified_messages[0]
                    if isinstance(modified_msg, dict):
                        query = modified_msg.get("content", query)
                    elif hasattr(modified_msg, "content"):
                        query = getattr(modified_msg, "content", query)

            # Invoke deep agent using async ainvoke() method
            # Deep agents use LangGraph format: {"messages": [{"role": "user", "content": query}]}
            # Use ainvoke() which is async and won't block
            self.logger.info(f"🚀 Invoking deep agent with query: '{query[:100]}...'")
            
            try:
                agent_result = await self.deep_agent.ainvoke({
                    "messages": [{"role": "user", "content": query}]
                })
                self.logger.info("✅ Deep agent invocation completed")
            except GuardrailsBlockedException as e:
                # Guardrails blocked the request during deep agent execution - return blocking message
                self.logger.warning(f"🚫 Request blocked by guardrails during execution: {e.reason}")
                result.success = True
                result.data = {
                    "response": e.message,
                    "answer": e.message,
                    "query": query,
                    "sources": [],
                    "confidence": 0.0,
                }
                result.metadata = {
                    "input_length": len(query),
                    "response_length": len(e.message),
                    "deep_agent_used": True,
                    "sources_count": 0,
                    "confidence": 0.0,
                    "blocked_by_guardrails": True,
                    "block_reason": e.reason,
                }
                result.mark_complete()
                return result

            # Log agent result structure for debugging
            self.logger.info(f"📊 Deep agent result structure: {type(agent_result)}")
            if isinstance(agent_result, dict):
                self.logger.info(f"   Keys: {list(agent_result.keys())}")
                # Log first few messages to understand structure
                if "messages" in agent_result:
                    self.logger.info(f"   Messages count: {len(agent_result['messages'])}")
                    for i, msg in enumerate(agent_result["messages"][:3]):
                        self.logger.info(f"   Message {i}: type={type(msg)}, keys={list(msg.keys()) if isinstance(msg, dict) else 'N/A'}")

            # Extract messages from agent result
            messages = agent_result.get("messages", []) if isinstance(agent_result, dict) else []
            
            # Extract response from agent result
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
                        tool_name = tc.get('name', 'unknown') if isinstance(tc, dict) else getattr(tc, 'name', 'N/A')
                        tool_args = tc.get('args', {}) if isinstance(tc, dict) else getattr(tc, 'args', {})
                        self.logger.info(f"      Tool call: {tool_name}")
                        self.logger.info(f"         Args: {tool_args}")
                        # Log filesystem tool usage for memory access tracking
                        filesystem_tools = ['read_file', 'write_file', 'ls', 'glob', 'grep', 'edit_file', 'execute']
                        if tool_name in filesystem_tools:
                            self.logger.info(f"         📁 FILESYSTEM TOOL DETECTED: '{tool_name}'")
                            if tool_name == 'glob' or tool_name == 'ls':
                                self.logger.info(f"            → Checking memory directory: {tool_args}")
                            elif tool_name == 'read_file':
                                self.logger.info(f"            → Reading from memory: {tool_args}")
                
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

            # Note: Memory is now saved automatically when agent uses filesystem tools
            # The agent can use write_file("/memories/...") to save data
            # Files will be written to disk at data/memories/ when agent uses absolute paths
            if self.enable_memory:
                self.logger.info("💾 Long-term memory available - agent can use write_file('/memories/...') to save data")
                self.logger.info("   Files will be saved to disk at: data/memories/")

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
