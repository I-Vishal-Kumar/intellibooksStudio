"""Analytics Agent - Database analytics agent using LangChain Deep Agents."""

from typing import Optional, Any, Dict, List
from pathlib import Path
import logging
import sys
import json
import time

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

# Import database providers
try:
    from ..database import (
        DatabaseProvider,
        DatabaseConfig,
        DatabaseType,
        create_database_provider,
        QueryResult,
        SchemaInfo,
    )
    DATABASE_AVAILABLE = True
except ImportError:
    try:
        # Try alternative import path
        project_root = Path(__file__).parent.parent.parent.parent.parent
        sys.path.insert(0, str(project_root))
        from services.agents.src.database import (
            DatabaseProvider,
            DatabaseConfig,
            DatabaseType,
            create_database_provider,
            QueryResult,
            SchemaInfo,
        )
        DATABASE_AVAILABLE = True
    except ImportError as e:
        logging.warning(f"Database providers not available: {e}")
        DATABASE_AVAILABLE = False
        DatabaseProvider = None
        DatabaseConfig = None
        DatabaseType = None
        create_database_provider = None
        QueryResult = None
        SchemaInfo = None

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
from ..middleware import ComplianceMiddleware, GuardrailsMiddleware
from ..middleware.guardrails_middleware import GuardrailsBlockedException

logger = logging.getLogger(__name__)


# Global database provider instance (per agent instance)
_db_provider: Optional[DatabaseProvider] = None


def get_db_provider() -> Optional[DatabaseProvider]:
    """Get the current database provider instance."""
    return _db_provider


def set_db_provider(provider: DatabaseProvider) -> None:
    """Set the database provider instance."""
    global _db_provider
    _db_provider = provider


def get_schema_info(
    schema_name: Optional[str] = None,
    table_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get database schema information.
    
    Args:
        schema_name: Optional schema name to filter
        table_name: Optional table name to filter
        
    Returns:
        Dictionary with schema information
    """
    logger.info(f"🔍 Getting schema info: schema={schema_name}, table={table_name}")
    
    provider = get_db_provider()
    if not provider:
        return {
            "error": "Database provider not configured. Please configure database connection first.",
            "tables": [],
            "columns": {},
            "relationships": [],
        }
    
    try:
        import asyncio
        import concurrent.futures
        
        def run_in_thread():
            """Run async code in a new thread."""
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(
                    provider.get_schema(schema_name=schema_name, table_name=table_name)
                )
            finally:
                new_loop.close()
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_thread)
            schema_info = future.result(timeout=30)
        
        # Convert SchemaInfo to dictionary
        result = {
            "tables": schema_info.tables,
            "columns": schema_info.columns,
            "relationships": schema_info.relationships,
        }
        
        logger.info(f"✅ Schema retrieved: {len(schema_info.tables)} tables")
        return result
    except Exception as e:
        logger.error(f"❌ Failed to get schema: {e}", exc_info=True)
        return {
            "error": str(e),
            "tables": [],
            "columns": {},
            "relationships": [],
        }


def generate_sql(
    question: str,
    schema_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate SQL query from natural language question.
    
    Args:
        question: Natural language question
        schema_context: Optional schema information for context
        
    Returns:
        Dictionary with generated SQL and metadata
    """
    logger.info(f"🤖 Generating SQL for question: '{question[:100]}...'")
    
    provider = get_db_provider()
    if not provider:
        return {
            "sql": None,
            "error": "Database provider not configured",
            "confidence": 0.0,
        }
    
    # This is a placeholder - in a real implementation, you'd use an LLM
    # to generate SQL from the question and schema context
    # For now, we'll return a simple response indicating this needs LLM integration
    
    return {
        "sql": None,
        "error": "SQL generation requires LLM integration (to be implemented in agent workflow)",
        "confidence": 0.0,
        "note": "Use the agent's built-in capabilities to generate SQL from natural language",
    }


def validate_sql_query(query: str) -> Dict[str, Any]:
    """
    Validate SQL query syntax and safety.
    
    Args:
        query: SQL query to validate
        
    Returns:
        Dictionary with validation results
    """
    logger.info(f"✅ Validating SQL query: '{query[:100]}...'")
    
    provider = get_db_provider()
    if not provider:
        return {
            "valid": False,
            "error": "Database provider not configured",
            "errors": ["Database provider not configured"],
        }
    
    try:
        import asyncio
        import concurrent.futures
        
        def run_in_thread():
            """Run async code in a new thread."""
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(provider.validate_query(query))
            finally:
                new_loop.close()
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_thread)
            validation_result = future.result(timeout=30)
        
        logger.info(f"✅ Validation result: valid={validation_result.get('valid')}")
        return validation_result
    except Exception as e:
        logger.error(f"❌ Validation failed: {e}", exc_info=True)
        return {
            "valid": False,
            "error": str(e),
            "errors": [str(e)],
        }


def execute_sql_query(
    query: str,
    params: Optional[List[Any]] = None,
    timeout: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute SQL query and return results.
    
    Args:
        query: SQL query to execute
        params: Optional query parameters
        timeout: Optional query timeout in seconds
        
    Returns:
        Dictionary with query results
    """
    logger.info(f"🚀 Executing SQL query: '{query[:100]}...'")
    
    provider = get_db_provider()
    if not provider:
        return {
            "rows": [],
            "columns": [],
            "row_count": 0,
            "error": "Database provider not configured",
        }
    
    # First validate the query
    validation = validate_sql_query(query)
    if not validation.get("valid", False):
        errors = validation.get("errors", [])
        return {
            "rows": [],
            "columns": [],
            "row_count": 0,
            "error": "; ".join(errors),
            "validation_failed": True,
        }
    
    try:
        import asyncio
        import concurrent.futures
        
        def run_in_thread():
            """Run async code in a new thread."""
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(
                    provider.execute_query(query, params=params, timeout=timeout)
                )
            finally:
                new_loop.close()
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_in_thread)
            query_result = future.result(timeout=timeout or 60)
        
        if query_result.error:
            logger.error(f"❌ Query execution error: {query_result.error}")
            return {
                "rows": [],
                "columns": [],
                "row_count": 0,
                "error": query_result.error,
            }
        
        logger.info(f"✅ Query executed: {query_result.row_count} rows in {query_result.execution_time_ms:.2f}ms")
        
        return {
            "rows": query_result.rows,
            "columns": query_result.columns,
            "row_count": query_result.row_count,
            "execution_time_ms": query_result.execution_time_ms,
        }
    except Exception as e:
        logger.error(f"❌ Query execution failed: {e}", exc_info=True)
        return {
            "rows": [],
            "columns": [],
            "row_count": 0,
            "error": str(e),
        }


class AnalyticsAgent(BaseAgent):
    """Analytics Agent using LangChain Deep Agents for database analytics."""

    def __init__(
        self,
        db_config: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        enable_memory: bool = True,
    ):
        """
        Initialize Analytics Agent.
        
        Args:
            db_config: Database configuration dictionary (optional, can be set later)
            session_id: Optional session ID for memory isolation
            enable_memory: Whether to enable long-term memory
        """
        if not DEEP_AGENTS_AVAILABLE:
            raise ImportError(
                "Deep Agents not available. Install with: pip install deepagents"
            )
        
        if not BASE_AGENT_AVAILABLE:
            raise ImportError(
                "BaseAgent not available. Cannot initialize AnalyticsAgent without BaseAgent."
            )
        
        if not DATABASE_AVAILABLE:
            raise ImportError(
                "Database providers not available. Cannot initialize AnalyticsAgent."
            )
        
        # Store session_id for memory isolation (before super().__init__)
        self.session_id = session_id or "default"
        self.enable_memory = enable_memory
        self.db_config = db_config
        
        # Get LLM settings
        llm_settings = create_llm_settings()
        
        # Define skills for the analytics agent
        skills = [
            Skill(
                name="database_analytics",
                confidence_score=0.90,
                input_types=["text/plain"],
                output_types=["text/plain", "application/json"],
                description="Analyze database data using natural language queries and generate insights",
            ),
            Skill(
                name="sql_generation",
                confidence_score=0.85,
                input_types=["text/plain"],
                output_types=["text/plain"],
                description="Generate SQL queries from natural language questions",
            ),
            Skill(
                name="schema_analysis",
                confidence_score=0.95,
                input_types=["text/plain"],
                output_types=["application/json"],
                description="Analyze database schema and relationships",
            ),
            Skill(
                name="data_insights",
                confidence_score=0.88,
                input_types=["application/json"],
                output_types=["text/plain", "application/json"],
                description="Generate executive insights from query results",
            ),
        ]
        
        # Initialize BaseAgent FIRST (this sets up self.logger)
        super().__init__(
            name="analytics-agent",
            agent_type="analytics",
            version="1.0.0",
            skills=skills,
            supported_actions=[ActionType.READ, ActionType.EXECUTE],
            trust_level=TrustLevel.VERIFIED,
            domain="analytics",
            llm_settings=llm_settings,
            default_temperature=0.2,  # Lower temperature for SQL generation accuracy
        )
        
        # Initialize database provider AFTER super().__init__() (so self.logger is available)
        self.db_provider: Optional[DatabaseProvider] = None
        if db_config:
            self._initialize_db_provider(db_config)
        
        # System prompt for the analytics agent
        analytics_instructions = """You are an expert database analytics assistant for the jAI Platform.
Your job is to translate natural language business questions into actionable SQL queries and provide
executive-ready insights from database results.

## Available Tools

### Filesystem Tools (AUTOMATICALLY AVAILABLE)
You have access to these filesystem tools that work with `/memories/`:
- `ls(path)`: List files in a directory
- `glob(pattern)`: Find files matching a pattern
- `read_file(path)`: Read a file
- `write_file(path, content)`: Write content to a file
- `edit_file(path, edits)`: Edit a file
- `grep(pattern, path)`: Search for text in files

### `get_schema_info`
Get database schema information including tables, columns, and relationships.
Use this to understand the database structure before generating SQL queries.

Parameters:
- schema_name: Optional schema name (default: public)
- table_name: Optional table name to filter

### `validate_sql_query`
Validate SQL query syntax and safety before execution.
This ensures queries are syntactically correct and only perform SELECT operations.

Parameters:
- query: SQL query to validate

### `execute_sql_query`
Execute a validated SQL query and return results.
Always validate queries before executing them.

Parameters:
- query: SQL query to execute
- params: Optional query parameters (for parameterized queries)
- timeout: Optional timeout in seconds (default: 60)

## Workflow

For natural language analytics queries:

1. **Understand the Question**: Parse the business question to identify:
   - What data is needed
   - What tables/columns are relevant
   - What aggregations or filters are required

2. **Get Schema Context**: Use `get_schema_info` to understand:
   - Available tables and columns
   - Data types and relationships
   - Foreign key connections

3. **Generate SQL**: Create a SQL query that answers the question:
   - Use proper JOINs based on relationships
   - Apply appropriate filters and aggregations
   - Include LIMIT clauses for large result sets
   - Use parameterized queries when possible

4. **Validate SQL**: Use `validate_sql_query` to ensure:
   - Syntax is correct
   - Only SELECT queries are used
   - Query is safe to execute

5. **Execute Query**: Use `execute_sql_query` to run the validated query

6. **Generate Insights**: Analyze results and provide:
   - Executive summary of findings
   - Key metrics and trends
   - Data-driven recommendations
   - Visualizations suggestions (describe, don't generate)

7. **Save to Memory**: Use `write_file` to save:
   - Query history: `/memories/session_{session_id}/query_history.json`
   - Insights: `/memories/session_{session_id}/insights/{query_id}.json`

## Guidelines

1. **Always validate before executing**: Never execute SQL without validation
2. **Use schema information**: Always check schema before generating queries
3. **Optimize queries**: Use appropriate indexes, avoid unnecessary JOINs
4. **Handle errors gracefully**: If a query fails, explain why and suggest alternatives
5. **Provide context**: Always cite which tables/columns were used
6. **Executive focus**: Translate technical results into business insights
7. **Security**: Only generate SELECT queries, never DROP, DELETE, INSERT, UPDATE, etc.

## Long-Term Memory

You have access to persistent long-term memory at `/memories/`:
- Save query history: `write_file("/memories/session_{session_id}/query_history.json", ...)`
- Save insights: `write_file("/memories/session_{session_id}/insights/{insight_id}.json", ...)`
- Save schema cache: `write_file("/memories/schema_cache.json", ...)`
- Read previous queries: `read_file("/memories/session_{session_id}/query_history.json")`

**Path Rules**:
- Use absolute paths: `/memories/...` (not relative paths)
- Files under `/memories/` persist across sessions
- Files under `/workspace/` are temporary (ephemeral)

Remember: Your goal is to provide accurate, actionable insights from database queries with proper
source attribution and executive-ready summaries."""

        # Create tools list
        tools = [get_schema_info, validate_sql_query, execute_sql_query]
        
        # Create compliance middleware
        compliance_middleware = ComplianceMiddleware(
            strict_mode=True,
            log_violations=True,
        )
        
        # Create guardrails middleware
        guardrails_middleware = GuardrailsMiddleware(
            detect_pii=True,
            pii_types=["email", "credit_card", "ip", "api_key", "phone", "ssn"],
            pii_strategy="redact",
            detect_prompt_injection=True,
            detect_toxic_content=True,
            banned_keywords=["drop table", "delete from", "truncate", "alter table"],
            use_model_safety_check=False,
            block_on_violation=True,
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
                self.logger.info(f"Long-term memory enabled for session: {self.session_id}")
                self.logger.info(f"  - FilesystemBackend root: {memories_absolute_path}")
            except Exception as e:
                self.logger.warning(f"Failed to initialize memory backend: {e}. Continuing without memory.")
                backend = None
        
        # Define sub-agents for specialized tasks
        subagents = [
            {
                "name": "data-dictionary-agent",
                "description": "Specialized agent for schema lookup and relationship discovery",
                "system_prompt": """You are a data dictionary specialist. Your job is to help understand
database schemas, table structures, column types, and relationships. Use get_schema_info extensively
to provide accurate schema information.""",
                "tools": [get_schema_info],
            },
            {
                "name": "sql-query-agent",
                "description": "Specialized agent for SQL generation and optimization",
                "system_prompt": """You are a SQL generation specialist. Your job is to create accurate,
optimized SQL queries from natural language questions. Always validate queries before suggesting execution.
Focus on query optimization and best practices.""",
                "tools": [get_schema_info, validate_sql_query],
            },
            {
                "name": "validation-agent",
                "description": "Specialized agent for SQL syntax and security validation",
                "system_prompt": """You are a SQL validation specialist. Your job is to ensure SQL queries
are syntactically correct, safe, and follow security best practices. Only allow SELECT queries.""",
                "tools": [validate_sql_query],
            },
            {
                "name": "execution-agent",
                "description": "Specialized agent for query execution and result analysis",
                "system_prompt": """You are a query execution specialist. Your job is to execute validated
SQL queries and analyze results. Always validate queries before execution.""",
                "tools": [validate_sql_query, execute_sql_query],
            },
        ]
        
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
                "system_prompt": analytics_instructions,
                "middleware": [guardrails_middleware, compliance_middleware],
            }
            
            # Add subagents if available
            try:
                create_kwargs["subagents"] = subagents
            except Exception:
                self.logger.debug("Subagents parameter not available in create_deep_agent")
            
            # Add backend if memory is enabled
            if backend is not None:
                try:
                    create_kwargs["backend"] = backend
                except Exception as e:
                    self.logger.warning(f"Backend parameter not available: {e}")
            
            try:
                self.deep_agent = create_deep_agent(**create_kwargs)
            except TypeError as e:
                # If create_deep_agent doesn't accept some parameters, try without them
                self.logger.warning(f"Some parameters not accepted by create_deep_agent: {e}")
                # Try with minimal parameters
                minimal_kwargs = {
                    "model": model,
                    "tools": tools,
                    "system_prompt": analytics_instructions,
                }
                if "middleware" in str(e).lower() or "subagents" in str(e).lower() or "backend" in str(e).lower():
                    # Remove problematic parameters
                    if "middleware" not in str(e).lower():
                        minimal_kwargs["middleware"] = [guardrails_middleware, compliance_middleware]
                self.deep_agent = create_deep_agent(**minimal_kwargs)
            self.logger.info("Deep Agent analytics agent initialized successfully")
            self.logger.info(f"  - Database: {'Configured' if self.db_provider else 'Not configured'}")
            self.logger.info(f"  - Middleware: GuardrailsMiddleware + ComplianceMiddleware enabled")
            self.logger.info(f"  - Memory: {'Enabled' if backend else 'Disabled'}")
            self.logger.info(f"  - Sub-agents: {len(subagents)} configured")
        except Exception as e:
            self.logger.error(f"Failed to create deep agent: {e}")
            raise

    def _initialize_db_provider(self, db_config: Dict[str, Any]) -> None:
        """Initialize database provider from configuration."""
        try:
            config = DatabaseConfig.from_dict(db_config)
            provider = create_database_provider(config)
            
            # Connect to database
            import asyncio
            import concurrent.futures
            
            def connect():
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    return new_loop.run_until_complete(provider.connect())
                finally:
                    new_loop.close()
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(connect)
                connected = future.result(timeout=30)
            
            if connected:
                self.db_provider = provider
                set_db_provider(provider)  # Set global for tools
                self.logger.info(f"✅ Database provider initialized: {config.db_type.value}")
            else:
                self.logger.warning("⚠️  Failed to connect to database")
        except Exception as e:
            self.logger.error(f"Failed to initialize database provider: {e}", exc_info=True)

    def configure_database(self, db_config: Dict[str, Any]) -> bool:
        """
        Configure database connection.
        
        Args:
            db_config: Database configuration dictionary
            
        Returns:
            True if configuration successful, False otherwise
        """
        self.db_config = db_config
        self._initialize_db_provider(db_config)
        return self.db_provider is not None

    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Execute analytics query using Deep Agent.

        Args:
            input_data: Dict with 'query', 'question', 'message', or 'text'
            context: Optional execution context

        Returns:
            AgentResult with analytics response
        """
        context = context or AgentContext()
        result = AgentResult(success=False, agent_id=self.agent_id)
        
        try:
            # Check if database is configured
            if not self.db_provider:
                result.error = "Database not configured. Please configure database connection first."
                result.mark_complete()
                return result
            
            # Extract query from input
            query = (
                input_data.get("query")
                or input_data.get("question")
                or input_data.get("message")
                or input_data.get("text", "")
            )
            
            if not query:
                result.error = "No analytics query provided"
                result.mark_complete()
                return result

            # Apply guardrails to input
            guardrails = GuardrailsMiddleware(
                detect_pii=True,
                pii_types=["email", "credit_card", "ip", "api_key", "phone", "ssn"],
                pii_strategy="redact",
                detect_prompt_injection=True,
                detect_toxic_content=True,
                banned_keywords=["drop table", "delete from", "truncate", "alter table"],
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
                self.logger.warning(f"🚫 Request blocked by guardrails: {e.reason}")
                result.success = True
                result.data = {
                    "response": e.message,
                    "answer": e.message,
                    "query": query,
                    "sql": None,
                    "results": None,
                }
                result.metadata = {
                    "blocked_by_guardrails": True,
                    "block_reason": e.reason,
                }
                result.mark_complete()
                return result
            
            # Get potentially modified query
            if guardrails_result and guardrails_result.get("messages"):
                modified_messages = guardrails_result["messages"]
                if modified_messages:
                    modified_msg = modified_messages[0]
                    if isinstance(modified_msg, dict):
                        query = modified_msg.get("content", query)
                    elif hasattr(modified_msg, "content"):
                        query = getattr(modified_msg, "content", query)

            # Invoke deep agent
            self.logger.info(f"🚀 Invoking analytics agent with query: '{query[:100]}...'")
            
            try:
                agent_result = await self.deep_agent.ainvoke({
                    "messages": [{"role": "user", "content": query}]
                })
                self.logger.info("✅ Analytics agent invocation completed")
            except GuardrailsBlockedException as e:
                self.logger.warning(f"🚫 Request blocked by guardrails during execution: {e.reason}")
                result.success = True
                result.data = {
                    "response": e.message,
                    "answer": e.message,
                    "query": query,
                    "sql": None,
                    "results": None,
                }
                result.metadata = {
                    "blocked_by_guardrails": True,
                    "block_reason": e.reason,
                }
                result.mark_complete()
                return result

            # Extract response from agent result
            messages = agent_result.get("messages", []) if isinstance(agent_result, dict) else []
            
            if messages:
                last_message = messages[-1]
                if isinstance(last_message, dict):
                    response_content = last_message.get("content", "")
                else:
                    response_content = getattr(last_message, "content", "")
            else:
                response_content = "No response generated"

            # Try to extract SQL and results from tool calls
            sql_query = None
            query_results = None
            
            for msg in messages:
                msg_dict = msg if isinstance(msg, dict) else msg.__dict__ if hasattr(msg, "__dict__") else {}
                
                # Check for tool calls
                tool_calls = msg_dict.get("tool_calls", [])
                for tc in tool_calls:
                    tool_name = tc.get('name', 'unknown') if isinstance(tc, dict) else getattr(tc, 'name', 'N/A')
                    if tool_name == 'execute_sql_query':
                        tool_args = tc.get('args', {}) if isinstance(tc, dict) else getattr(tc, 'args', {})
                        sql_query = tool_args.get('query')
                
                # Check for tool results
                if msg_dict.get("role") == "tool":
                    content = msg_dict.get("content", "")
                    if isinstance(content, str):
                        try:
                            content = json.loads(content)
                        except:
                            pass
                    
                    if isinstance(content, dict):
                        if "rows" in content:
                            query_results = content

            # Build response data
            response_data = {
                "response": response_content,
                "answer": response_content,
                "query": query,
                "sql": sql_query,
                "results": query_results,
            }
            
            self.logger.info(f"📤 Final response data: SQL generated={sql_query is not None}, Results={query_results is not None}")

            # Return AgentResult
            result.success = True
            result.data = response_data
            result.metadata = {
                "input_length": len(query),
                "response_length": len(response_content),
                "deep_agent_used": True,
                "sql_generated": sql_query is not None,
                "results_returned": query_results is not None,
            }
            result.mark_complete()
            return result

        except Exception as e:
            self.logger.exception("Analytics agent execution failed")
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

