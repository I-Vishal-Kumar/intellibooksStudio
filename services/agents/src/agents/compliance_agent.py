"""Compliance Agent - Regulatory compliance validation agent using LangChain Deep Agents."""

from typing import Optional, Any, Dict, List
from pathlib import Path
import logging
import sys
import re
import json

# Import Deep Agents
try:
    from deepagents import create_deep_agent
    DEEP_AGENTS_AVAILABLE = True
except ImportError:
    try:
        project_root = Path(__file__).parent.parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from deepagents import create_deep_agent
        DEEP_AGENTS_AVAILABLE = True
    except ImportError as e:
        logging.warning(f"Deep Agents not available: {e}. Install with: pip install deepagents")
        DEEP_AGENTS_AVAILABLE = False
        create_deep_agent = None

# Import RAG components for regulatory knowledge search
try:
    from services.rag.src.rag_pipeline import ChromaDBStore, RAGConfig, load_config
    from services.rag.src.vector_store import ChromaVectorStore
    from services.rag.src.retriever import SemanticRetriever
    from services.rag.src.query_engine import RAGQueryEngine
    RAG_AVAILABLE = True
except ImportError:
    try:
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

# Import BaseAgent
_agent_framework_path = str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "agent-framework" / "src")
if _agent_framework_path not in sys.path:
    sys.path.insert(0, _agent_framework_path)

try:
    from identity.card import Skill, TrustLevel, ActionType
    from base.agent import BaseAgent, AgentResult, AgentContext
    BASE_AGENT_AVAILABLE = True
except ImportError:
    try:
        from identity import Skill, TrustLevel, ActionType
        from base import BaseAgent, AgentResult, AgentContext
        BASE_AGENT_AVAILABLE = True
    except ImportError:
        BASE_AGENT_AVAILABLE = False
        BaseAgent = None
        AgentResult = None
        AgentContext = None

from ..llm_factory import create_llm_settings
from ..middleware import ComplianceMiddleware

logger = logging.getLogger(__name__)


# Global RAG engine instance for regulatory knowledge
_rag_engine = None


def get_rag_engine():
    """Get or create the global RAG engine instance for regulatory knowledge."""
    global _rag_engine
    if _rag_engine is None and RAG_AVAILABLE:
        try:
            rag_config = load_config()
            collection_name = rag_config.chroma_collection
            logger.info(f"Initializing RAG engine for compliance agent with collection: {collection_name}")

            vector_store = ChromaVectorStore(
                collection_name=collection_name,
                embedding_model=rag_config.embedding_model,
            )

            retriever = SemanticRetriever(
                vector_store=vector_store,
                default_top_k=5,
                min_score_threshold=0.3,
            )

            from services.rag.src.config import get_settings
            rag_settings = get_settings()

            _rag_engine = RAGQueryEngine(
                retriever=retriever,
                llm_provider=rag_settings.default_llm_provider,
            )

            logger.info("RAG engine initialized successfully for compliance agent")
        except Exception as e:
            logger.error(f"Failed to initialize RAG engine: {e}", exc_info=True)
            _rag_engine = None

    return _rag_engine


def search_regulations(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Search for regulatory information using RAG.
    
    Args:
        query: The regulatory query (e.g., "FL fair lending requirements")
        top_k: Number of results to return
    
    Returns:
        Dictionary with regulatory information and sources
    """
    logger.info(f"🔍 Searching regulations: '{query}', top_k: {top_k}")
    
    rag_engine = get_rag_engine()
    
    if not rag_engine:
        logger.warning("⚠️  RAG engine not available - using fallback")
        return {
            "answer": "Regulatory knowledge base is currently unavailable. Please consult official regulatory sources.",
            "sources": [],
            "error": "RAG engine not initialized",
        }
    
    try:
        import asyncio
        import concurrent.futures
        
        def run_in_thread():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(
                    rag_engine.query(query, top_k=top_k)
                )
            finally:
                new_loop.close()
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_thread)
            rag_response = future.result(timeout=30)
        
        logger.info(f"✅ Regulatory search completed: {len(rag_response.sources)} sources found")
        
        return {
            "answer": rag_response.answer,
            "sources": rag_response.sources,
            "confidence": rag_response.confidence,
            "retrieval_stats": rag_response.retrieval_stats,
        }
    except Exception as e:
        logger.error(f"❌ Regulatory search failed: {e}", exc_info=True)
        return {
            "answer": f"Error searching regulatory knowledge: {str(e)}",
            "sources": [],
            "error": str(e),
        }


def validate_compliance(
    content: str,
    context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate content for compliance violations.
    
    Args:
        content: The content to validate (response, decision, etc.)
        context: Optional context about the content (e.g., user query/input)
    
    Returns:
        Dictionary with validation results, violations, and recommendations
    """
    logger.info(f"🔍 Validating compliance for content: '{content[:100]}...'")
    if context:
        logger.info(f"   Context (user input): '{context[:100]}...'")
    
    # Prohibited patterns (financial compliance)
    prohibited_patterns = [
        (r'\bguarantee\b.*\bprofit\b', "Guarantee of profit"),
        (r'\bguarantee\b.*\breturn\b', "Guarantee of return"),
        (r'\brisk-free\b', "Risk-free claim"),
        (r'\bno risk\b', "No risk claim"),
        (r'\bguaranteed.*\bwin\b', "Guaranteed win"),
    ]
    
    # Hate speech and discriminatory language patterns
    hate_speech_patterns = [
        (r'\b(hate|hates|hating|hated)\b.*\b(black|white|asian|hispanic|jewish|muslim|christian|gay|lesbian|transgender|disabled|women|men)\b', "Hate speech - discriminatory language"),
        (r'\b(hate|hates|hating|hated)\b.*\b(people|person|group|race|religion|ethnicity)\b', "Hate speech - general discriminatory language"),
        (r'\b(racist|racism|prejudice|bigot|bigoted|discriminat)\b', "Discriminatory language"),
        (r'\b(superior|inferior)\b.*\b(race|ethnicity|religion|gender)\b', "Discriminatory superiority claim"),
        (r'\b(all|every)\b.*\b(black|white|asian|hispanic|jewish|muslim|christian|gay|lesbian|transgender)\b.*\b(are|is)\b.*\b(bad|evil|stupid|inferior|wrong)\b', "Generalization with discriminatory language"),
    ]
    
    # Fair lending violations (more comprehensive)
    fair_lending_patterns = [
        (r'\bdeny\b.*\b(because|due to|based on)\b.*\b(race|religion|gender|age|nationality|ethnicity|sexual orientation)\b', "Fair lending violation - denial based on protected characteristic"),
        (r'\bprefer\b.*\b(because|due to)\b.*\b(race|religion|gender|age|nationality|ethnicity|sexual orientation)\b', "Fair lending violation - preference based on protected characteristic"),
        (r'\b(reject|refuse|decline)\b.*\b(because|due to|based on)\b.*\b(race|religion|gender|age|nationality|ethnicity|sexual orientation)\b', "Fair lending violation - rejection based on protected characteristic"),
    ]
    
    violations = []
    content_lower = content.lower()
    
    # Also check context (user input) for hate speech if provided
    context_lower = context.lower() if context else ""
    content_to_check = content_lower
    if context and context_lower:
        # Check context separately for hate speech (user input validation)
        for pattern, description in hate_speech_patterns:
            matches = re.finditer(pattern, context_lower)
            for match in matches:
                violations.append({
                    "type": "hate_speech_input",
                    "pattern": pattern,
                    "description": f"Hate speech detected in user input: {description}",
                    "match": match.group(),
                    "position": match.start(),
                    "severity": "critical",
                    "source": "user_input",
                })
    
    # Check prohibited patterns (financial compliance)
    for pattern, description in prohibited_patterns:
        matches = re.finditer(pattern, content_lower)
        for match in matches:
            violations.append({
                "type": "prohibited_term",
                "pattern": pattern,
                "description": description,
                "match": match.group(),
                "position": match.start(),
                "severity": "high",
            })
    
    # Check hate speech and discriminatory language (CRITICAL - highest priority)
    for pattern, description in hate_speech_patterns:
        matches = re.finditer(pattern, content_lower)
        for match in matches:
            violations.append({
                "type": "hate_speech",
                "pattern": pattern,
                "description": description,
                "match": match.group(),
                "position": match.start(),
                "severity": "critical",
            })
    
    # Check fair lending violations
    for pattern, description in fair_lending_patterns:
        matches = re.finditer(pattern, content_lower)
        for match in matches:
            violations.append({
                "type": "fair_lending",
                "pattern": pattern,
                "description": description,
                "match": match.group(),
                "position": match.start(),
                "severity": "critical",
            })
    
    # Determine compliance status
    is_compliant = len(violations) == 0
    severity = "none"
    if violations:
        severities = [v["severity"] for v in violations]
        if "critical" in severities:
            severity = "critical"
        elif "high" in severities:
            severity = "high"
        else:
            severity = "medium"
    
    # Generate recommendations
    recommendations = []
    if not is_compliant:
        recommendations.append("Remove or modify language that violates compliance requirements")
        
        # Specific recommendations based on violation type
        if any(v["type"] == "hate_speech" for v in violations):
            recommendations.append("CRITICAL: Remove all hate speech and discriminatory language immediately")
            recommendations.append("Do not engage with or respond to hateful content")
        if any(v["type"] == "fair_lending" for v in violations):
            recommendations.append("Review decision-making process to ensure no protected characteristics are used")
        if any(v["type"] == "prohibited_term" for v in violations):
            recommendations.append("Add appropriate disclaimers about risks and limitations")
    
    result = {
        "is_compliant": is_compliant,
        "violations": violations,
        "violation_count": len(violations),
        "severity": severity,
        "recommendations": recommendations,
        "context": context,
    }
    
    logger.info(f"✅ Compliance validation: {'COMPLIANT' if is_compliant else f'NON-COMPLIANT ({len(violations)} violations)'}")
    
    return result


def audit_decision(
    decision: str,
    tool_name: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    reviewer_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Log a compliance decision for audit purposes.
    
    Args:
        decision: The decision made (approve, edit, reject)
        tool_name: Name of the tool that triggered the decision
        parameters: Parameters used in the tool call
        reviewer_id: ID of the reviewer (if human-in-the-loop)
    
    Returns:
        Audit log entry
    """
    import datetime
    
    audit_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "decision": decision,
        "tool_name": tool_name,
        "parameters": parameters or {},
        "reviewer_id": reviewer_id,
    }
    
    logger.info(f"📋 Audit log: {decision} for {tool_name} by {reviewer_id or 'system'}")
    
    # In production, this would write to a database or audit log service
    # For now, we'll just log it
    return audit_entry


class ComplianceAgent(BaseAgent):
    """Compliance Agent using LangChain Deep Agents for regulatory compliance validation."""

    def __init__(self, session_id: Optional[str] = None, enable_memory: bool = True):
        if not DEEP_AGENTS_AVAILABLE:
            raise ImportError(
                "Deep Agents not available. Install with: pip install deepagents"
            )
        
        if not BASE_AGENT_AVAILABLE:
            raise ImportError(
                "BaseAgent not available. Cannot initialize ComplianceAgent without BaseAgent."
            )
        
        self.session_id = session_id or "default"
        self.enable_memory = enable_memory
        
        llm_settings = create_llm_settings()
        
        # Define skills for the compliance agent
        skills = [
            Skill(
                name="compliance_validation",
                confidence_score=0.95,
                input_types=["text/plain", "application/json"],
                output_types=["application/json"],
                description="Validate content for regulatory compliance violations",
            ),
            Skill(
                name="regulatory_search",
                confidence_score=0.90,
                input_types=["text/plain"],
                output_types=["text/plain", "application/json"],
                description="Search regulatory knowledge base for compliance requirements",
            ),
            Skill(
                name="audit_logging",
                confidence_score=0.98,
                input_types=["application/json"],
                output_types=["application/json"],
                description="Log compliance decisions for audit purposes",
            ),
        ]
        
        # Initialize BaseAgent
        super().__init__(
            name="compliance-agent",
            agent_type="compliance",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            domain="compliance",
            llm_settings=llm_settings,
            default_temperature=0.2,  # Compliance needs high accuracy
        )
        
        # System prompt for compliance agent
        compliance_instructions = """You are an expert regulatory compliance agent for the Audio Insight Platform.
Your job is to validate content, decisions, and responses for regulatory compliance.

## Available Tools

### `validate_compliance`
Use this to validate any content (responses, decisions, statements) for compliance violations.
- Checks for prohibited terms (guarantees, risk-free claims)
- Checks for fair lending violations
- Provides recommendations for fixing violations

### `search_regulations`
Use this to search the regulatory knowledge base for specific compliance requirements.
- Search for regulations by topic (e.g., "FL fair lending requirements")
- Get detailed regulatory information with sources
- Use this before making compliance decisions

### `audit_decision`
Use this to log compliance decisions for audit purposes.
- Log approve/edit/reject decisions
- Track tool usage and parameters
- Maintain audit trail

## Guidelines

1. **Always Validate**: Validate all content before approval
2. **Search First**: Search regulations before making compliance decisions
3. **Document Everything**: Log all compliance decisions for audit
4. **Be Strict**: Err on the side of caution - if unsure, flag as non-compliant
5. **Provide Recommendations**: Always suggest how to fix violations

## Workflow

For compliance validation:
1. Use `search_regulations` to understand requirements
2. Use `validate_compliance` to check content
3. If violations found, provide clear recommendations
4. Use `audit_decision` to log the validation result

Remember: Your goal is to ensure all content meets regulatory compliance standards."""

        # Create tools list
        tools = [validate_compliance, search_regulations, audit_decision]
        
        # Create compliance middleware (for passive validation)
        compliance_middleware = ComplianceMiddleware(
            strict_mode=True,
            log_violations=True,
        )
        
        # Create memory backend if enabled
        backend = None
        if self.enable_memory:
            try:
                from deepagents.backends import StateBackend, FilesystemBackend, CompositeBackend
                
                project_root = Path(__file__).parent.parent.parent.parent.parent
                memories_dir = project_root / "data" / "memories"
                memories_dir.mkdir(parents=True, exist_ok=True)
                memories_absolute_path = str(memories_dir.absolute())
                
                def create_backend(runtime):
                    return CompositeBackend(
                        default=StateBackend(runtime),
                        routes={
                            "/memories/": FilesystemBackend(
                                root_dir=memories_absolute_path,
                                virtual_mode=True,
                            ),
                        }
                    )
                
                backend = create_backend
                self.logger.info(f"Long-term memory enabled for compliance agent")
            except Exception as e:
                self.logger.warning(f"Failed to initialize memory backend: {e}")
                backend = None
        
        # Create the model instance
        try:
            from langchain_openai import ChatOpenAI
            from langchain_anthropic import ChatAnthropic
            
            provider = llm_settings.get("provider", "openrouter")
            api_key = llm_settings.get("api_key", "")
            model_name = llm_settings.get("model", "anthropic/claude-sonnet-4")
            
            if not api_key:
                raise ValueError(f"API key not configured for provider: {provider}")
            
            if provider == "openai":
                model = ChatOpenAI(
                    model=model_name,
                    api_key=api_key,
                    temperature=0.2,
                )
            elif provider == "anthropic":
                model = ChatAnthropic(
                    model=model_name,
                    api_key=api_key,
                    temperature=0.2,
                )
            else:  # openrouter
                model = ChatOpenAI(
                    model=model_name,
                    api_key=api_key,
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.2,
                )
            
            # Create deep agent
            create_kwargs = {
                "model": model,
                "tools": tools,
                "system_prompt": compliance_instructions,
                "middleware": [compliance_middleware],
            }
            
            if backend is not None:
                create_kwargs["backend"] = backend
            
            self.deep_agent = create_deep_agent(**create_kwargs)
            self.logger.info("Compliance Agent initialized successfully")
            self.logger.info(f"  - Tools: validate_compliance, search_regulations, audit_decision")
            self.logger.info(f"  - Memory: {'Enabled' if backend else 'Disabled'}")
        except Exception as e:
            self.logger.error(f"Failed to create compliance agent: {e}")
            raise

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Execute compliance validation or regulatory search.

        Args:
            input_data: Dict with 'query', 'content', 'validate', or 'search'
            context: Optional execution context

        Returns:
            AgentResult with compliance validation results
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)
        
        try:
            # Extract query/content from input
            query = (
                input_data.get("query")
                or input_data.get("content")
                or input_data.get("validate")
                or input_data.get("search")
                or input_data.get("message")
                or input_data.get("text", "")
            )
            
            if not query:
                result.error = "No compliance query or content provided"
                result.mark_complete()
                return result

            # Invoke deep agent
            self.logger.info(f"🚀 Invoking compliance agent with query: '{query[:100]}...'")
            agent_result = await self.deep_agent.ainvoke({
                "messages": [{"role": "user", "content": query}]
            })
            self.logger.info("✅ Compliance agent invocation completed")

            # Extract response
            messages = agent_result.get("messages", []) if isinstance(agent_result, dict) else []
            if messages:
                last_message = messages[-1]
                if isinstance(last_message, dict):
                    response_content = last_message.get("content", "")
                else:
                    response_content = getattr(last_message, "content", "")
            else:
                response_content = "No response generated"

            # Extract tool results (compliance validation, regulatory search, etc.)
            validation_results = []
            regulatory_info = []
            
            for msg in messages:
                msg_dict = msg if isinstance(msg, dict) else msg.__dict__ if hasattr(msg, "__dict__") else {}
                
                if msg_dict.get("role") == "tool" or "tool" in str(msg_dict.get("type", "")).lower():
                    content = msg_dict.get("content", "")
                    if isinstance(content, str):
                        try:
                            content = json.loads(content)
                        except:
                            pass
                    
                    if isinstance(content, dict):
                        if "is_compliant" in content or "violations" in content:
                            validation_results.append(content)
                        if "sources" in content or "regulatory" in str(content).lower():
                            regulatory_info.append(content)

            # Build response data
            response_data = {
                "response": response_content,
                "validation_results": validation_results,
                "regulatory_info": regulatory_info,
            }
            
            # Return AgentResult
            result.success = True
            result.data = response_data
            result.metadata = {
                "input_length": len(query),
                "response_length": len(response_content),
                "deep_agent_used": True,
            }
            result.mark_complete()
            return result

        except Exception as e:
            self.logger.exception("Compliance agent execution failed")
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

