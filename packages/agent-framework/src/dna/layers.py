"""
Agent DNA Blueprint - Layer Definitions

The DNA Blueprint defines the core architecture of an agent with these layers:
1. Cognitive Layer (Reasoning, Planning, Reflection)
2. Knowledge Layer (RAG Engine, Graph Query, Memory)
3. Execution Layer (Tool Use, Actions, Workflows)
4. Safety Layer (Guardrails, Compliance)
5. Learning Layer (Feedback, Adaptation)
6. Social Layer (A2A Comms, Delegation)
7. Observability
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, AsyncIterator
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================
# COGNITIVE LAYER
# Reasoning, Planning, Reflection
# ============================================

class ReasoningResult(BaseModel):
    """Result from reasoning engine."""
    conclusion: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning_chain: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)


class PlanStep(BaseModel):
    """A step in an execution plan."""
    step_id: str
    description: str
    action: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list)
    estimated_duration_ms: Optional[int] = None


class ReasoningEngine(ABC):
    """
    Chain-of-thought and deliberative reasoning.
    Enables agents to think through complex problems step by step.
    """

    @abstractmethod
    async def reason(
        self,
        query: str,
        context: Dict[str, Any],
        max_steps: int = 10
    ) -> ReasoningResult:
        """
        Perform step-by-step reasoning on a query.

        Args:
            query: The question or problem to reason about
            context: Relevant context information
            max_steps: Maximum reasoning steps

        Returns:
            ReasoningResult with conclusion and reasoning chain
        """
        pass

    @abstractmethod
    async def decompose(self, complex_query: str) -> List[str]:
        """Break down a complex query into simpler sub-queries."""
        pass


class PlanningModule(ABC):
    """
    Task decomposition and planning.
    Creates executable plans from high-level goals.
    """

    @abstractmethod
    async def create_plan(
        self,
        goal: str,
        constraints: List[str] = None,
        available_tools: List[str] = None
    ) -> List[PlanStep]:
        """
        Create an execution plan for a goal.

        Args:
            goal: The objective to achieve
            constraints: Any constraints on the plan
            available_tools: Tools available for execution

        Returns:
            Ordered list of plan steps
        """
        pass

    @abstractmethod
    async def validate_plan(self, plan: List[PlanStep]) -> Dict[str, Any]:
        """Validate a plan for feasibility and completeness."""
        pass

    @abstractmethod
    async def replan(
        self,
        original_plan: List[PlanStep],
        failure_point: str,
        error: str
    ) -> List[PlanStep]:
        """Create a new plan after a failure."""
        pass


class ReflectionEngine(ABC):
    """
    Self-evaluation and improvement.
    Enables agents to learn from their actions.
    """

    @abstractmethod
    async def evaluate_action(
        self,
        action: str,
        expected_result: Any,
        actual_result: Any
    ) -> Dict[str, Any]:
        """
        Evaluate the outcome of an action.

        Returns:
            Dict with score, analysis, and improvement suggestions
        """
        pass

    @abstractmethod
    async def analyze_failure(
        self,
        action: str,
        error: Exception
    ) -> Dict[str, Any]:
        """Analyze why an action failed and suggest fixes."""
        pass

    @abstractmethod
    async def summarize_session(
        self,
        actions: List[Dict[str, Any]]
    ) -> str:
        """Create a summary of actions taken in a session."""
        pass


class CognitiveLayer(BaseModel):
    """The thinking and reasoning capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    reasoning: Optional[ReasoningEngine] = None
    planning: Optional[PlanningModule] = None
    reflection: Optional[ReflectionEngine] = None

    def has_reasoning(self) -> bool:
        return self.reasoning is not None

    def has_planning(self) -> bool:
        return self.planning is not None

    def has_reflection(self) -> bool:
        return self.reflection is not None


# ============================================
# KNOWLEDGE LAYER
# RAG Engine, Graph Query, Memory
# ============================================

class RetrievedChunk(BaseModel):
    """A chunk of retrieved knowledge."""
    content: str
    source: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RAGEngine(ABC):
    """
    Retrieval-Augmented Generation.
    Retrieves relevant knowledge to augment LLM responses.
    """

    @abstractmethod
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[RetrievedChunk]:
        """Retrieve relevant documents for a query."""
        pass

    @abstractmethod
    async def generate_with_context(
        self,
        query: str,
        context: List[RetrievedChunk]
    ) -> str:
        """Generate a response using retrieved context."""
        pass

    @abstractmethod
    async def index_document(
        self,
        content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Index a new document. Returns document ID."""
        pass


class GraphQueryEngine(ABC):
    """
    Knowledge graph traversal.
    Queries structured knowledge in graph databases.
    """

    @abstractmethod
    async def query(self, cypher: str) -> List[Dict[str, Any]]:
        """Execute a Cypher query against the knowledge graph."""
        pass

    @abstractmethod
    async def find_relationships(
        self,
        entity: str,
        relationship_type: Optional[str] = None,
        max_depth: int = 2
    ) -> List[Dict[str, Any]]:
        """Find relationships for an entity."""
        pass

    @abstractmethod
    async def shortest_path(
        self,
        start_entity: str,
        end_entity: str
    ) -> List[Dict[str, Any]]:
        """Find the shortest path between two entities."""
        pass


class MemoryEntry(BaseModel):
    """An entry in agent memory."""
    key: str
    value: Any
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    access_count: int = 0


class MemoryStore(ABC):
    """
    Short and long-term memory for agents.
    Persists information across interactions.
    """

    @abstractmethod
    async def remember(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None
    ) -> None:
        """Store a value in memory."""
        pass

    @abstractmethod
    async def recall(self, key: str) -> Optional[Any]:
        """Retrieve a value from memory."""
        pass

    @abstractmethod
    async def forget(self, key: str) -> bool:
        """Remove a value from memory."""
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        limit: int = 10
    ) -> List[MemoryEntry]:
        """Search memory for relevant entries."""
        pass


class KnowledgeLayer(BaseModel):
    """The knowledge and memory capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    rag_engine: Optional[RAGEngine] = None
    graph_query: Optional[GraphQueryEngine] = None
    memory: Optional[MemoryStore] = None


# ============================================
# EXECUTION LAYER
# Tool Use, Actions, Workflows
# ============================================

class ToolDefinition(BaseModel):
    """Definition of an available tool."""
    name: str
    description: str
    parameters: Dict[str, Any]
    required_trust_level: str = "basic"


class ToolResult(BaseModel):
    """Result from tool execution."""
    tool_name: str
    success: bool
    result: Any
    error: Optional[str] = None
    duration_ms: int


class ToolUseModule(ABC):
    """
    Tool discovery and invocation.
    Enables agents to use external tools.
    """

    @abstractmethod
    async def discover_tools(self) -> List[ToolDefinition]:
        """Discover available tools."""
        pass

    @abstractmethod
    async def invoke_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> ToolResult:
        """Invoke a tool with parameters."""
        pass

    @abstractmethod
    async def validate_parameters(
        self,
        tool_name: str,
        parameters: Dict[str, Any]
    ) -> bool:
        """Validate parameters before tool invocation."""
        pass


class ActionExecutor(ABC):
    """
    Action execution with retries and fallbacks.
    Handles the actual execution of planned actions.
    """

    @abstractmethod
    async def execute(
        self,
        action: str,
        parameters: Dict[str, Any],
        timeout_ms: int = 30000
    ) -> Any:
        """Execute an action with timeout."""
        pass

    @abstractmethod
    async def execute_with_retry(
        self,
        action: str,
        parameters: Dict[str, Any],
        max_retries: int = 3
    ) -> Any:
        """Execute an action with automatic retries."""
        pass


class WorkflowStep(BaseModel):
    """A step in a workflow."""
    step_id: str
    action: str
    status: str = "pending"
    result: Optional[Any] = None
    error: Optional[str] = None


class WorkflowEngine(ABC):
    """
    Multi-step workflow orchestration.
    Manages complex multi-step processes.
    """

    @abstractmethod
    async def start_workflow(
        self,
        workflow_id: str,
        inputs: Dict[str, Any]
    ) -> str:
        """Start a workflow. Returns execution ID."""
        pass

    @abstractmethod
    async def get_workflow_status(
        self,
        execution_id: str
    ) -> Dict[str, Any]:
        """Get the status of a workflow execution."""
        pass

    @abstractmethod
    async def cancel_workflow(self, execution_id: str) -> bool:
        """Cancel a running workflow."""
        pass


class ExecutionLayer(BaseModel):
    """The action and tool-use capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    tool_use: Optional[ToolUseModule] = None
    actions: Optional[ActionExecutor] = None
    workflows: Optional[WorkflowEngine] = None


# ============================================
# SAFETY LAYER
# Guardrails, Compliance
# ============================================

class SafetyCheckResult(BaseModel):
    """Result of a safety check."""
    passed: bool
    violations: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)


class Guardrails(ABC):
    """
    Input/output validation and safety checks.
    Ensures agent behavior stays within bounds.
    """

    @abstractmethod
    async def validate_input(self, input_data: Any) -> SafetyCheckResult:
        """Validate input data for safety."""
        pass

    @abstractmethod
    async def validate_output(self, output_data: Any) -> SafetyCheckResult:
        """Validate output data before returning."""
        pass

    @abstractmethod
    async def check_content_safety(self, content: str) -> SafetyCheckResult:
        """Check content for harmful or inappropriate material."""
        pass

    @abstractmethod
    async def check_pii(self, content: str) -> Dict[str, List[str]]:
        """Detect personally identifiable information."""
        pass


class AuditEntry(BaseModel):
    """An audit log entry."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_id: str
    action: str
    resource: Optional[str] = None
    outcome: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ComplianceChecker(ABC):
    """
    Policy and compliance enforcement.
    Ensures agent actions comply with policies.
    """

    @abstractmethod
    async def check_policy(
        self,
        action: str,
        resource: str,
        context: Dict[str, Any]
    ) -> bool:
        """Check if an action is allowed by policy."""
        pass

    @abstractmethod
    async def audit_log(self, entry: AuditEntry) -> None:
        """Record an audit log entry."""
        pass

    @abstractmethod
    async def get_applicable_policies(
        self,
        action: str,
        resource: str
    ) -> List[Dict[str, Any]]:
        """Get policies that apply to an action/resource."""
        pass


class SafetyLayer(BaseModel):
    """The safety and compliance capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    guardrails: Optional[Guardrails] = None
    compliance: Optional[ComplianceChecker] = None


# ============================================
# LEARNING LAYER
# Feedback, Adaptation
# ============================================

class FeedbackEntry(BaseModel):
    """A feedback entry."""
    feedback_id: str
    agent_id: str
    action: str
    rating: float = Field(ge=0.0, le=1.0)
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FeedbackProcessor(ABC):
    """
    Human and automated feedback processing.
    Enables continuous improvement.
    """

    @abstractmethod
    async def process_feedback(self, feedback: FeedbackEntry) -> None:
        """Process and store feedback."""
        pass

    @abstractmethod
    async def get_performance_metrics(
        self,
        agent_id: str,
        time_range_days: int = 30
    ) -> Dict[str, float]:
        """Get performance metrics from feedback."""
        pass

    @abstractmethod
    async def get_improvement_suggestions(
        self,
        agent_id: str
    ) -> List[str]:
        """Get suggestions for improvement based on feedback."""
        pass


class AdaptationEngine(ABC):
    """
    Dynamic behavior adaptation.
    Allows agents to adapt based on performance.
    """

    @abstractmethod
    async def adapt(
        self,
        performance_metrics: Dict[str, float]
    ) -> Dict[str, Any]:
        """Adapt behavior based on metrics. Returns new parameters."""
        pass

    @abstractmethod
    async def get_current_parameters(self) -> Dict[str, Any]:
        """Get current adaptation parameters."""
        pass

    @abstractmethod
    async def reset_to_default(self) -> None:
        """Reset to default parameters."""
        pass


class LearningLayer(BaseModel):
    """The learning and adaptation capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    feedback: Optional[FeedbackProcessor] = None
    adaptation: Optional[AdaptationEngine] = None


# ============================================
# SOCIAL LAYER
# A2A Comms, Delegation
# ============================================

class AgentMessage(BaseModel):
    """A message between agents."""
    message_id: str
    from_agent: str
    to_agent: str
    message_type: str  # request, response, notification, broadcast
    content: Any
    correlation_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class A2ACommunication(ABC):
    """
    Agent-to-Agent communication.
    Enables collaboration between agents.
    """

    @abstractmethod
    async def send_message(
        self,
        target_agent: str,
        message_type: str,
        content: Any
    ) -> str:
        """Send a message to another agent. Returns message ID."""
        pass

    @abstractmethod
    async def receive_messages(
        self,
        timeout_ms: int = 5000
    ) -> List[AgentMessage]:
        """Receive pending messages."""
        pass

    @abstractmethod
    async def broadcast(
        self,
        group: str,
        message_type: str,
        content: Any
    ) -> None:
        """Broadcast a message to a group of agents."""
        pass

    @abstractmethod
    async def subscribe(self, channel: str) -> None:
        """Subscribe to a communication channel."""
        pass


class DelegationRequest(BaseModel):
    """A task delegation request."""
    delegation_id: str
    from_agent: str
    to_agent: str
    task: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    priority: str = "normal"
    deadline: Optional[datetime] = None


class DelegationManager(ABC):
    """
    Task delegation to other agents.
    Enables hierarchical task distribution.
    """

    @abstractmethod
    async def delegate(
        self,
        task: str,
        target_agent: str,
        parameters: Dict[str, Any] = None,
        priority: str = "normal"
    ) -> str:
        """Delegate a task. Returns delegation ID."""
        pass

    @abstractmethod
    async def get_delegation_status(
        self,
        delegation_id: str
    ) -> Dict[str, Any]:
        """Get status of a delegation."""
        pass

    @abstractmethod
    async def await_delegation_result(
        self,
        delegation_id: str,
        timeout_ms: int = 60000
    ) -> Any:
        """Wait for and return delegation result."""
        pass

    @abstractmethod
    async def cancel_delegation(self, delegation_id: str) -> bool:
        """Cancel a pending delegation."""
        pass


class SocialLayer(BaseModel):
    """The social and collaboration capabilities of an agent."""

    class Config:
        arbitrary_types_allowed = True

    communication: Optional[A2ACommunication] = None
    delegation: Optional[DelegationManager] = None


# ============================================
# OBSERVABILITY
# Metrics, Tracing, Logging
# ============================================

class Span(BaseModel):
    """A tracing span."""
    span_id: str
    trace_id: str
    parent_span_id: Optional[str] = None
    operation_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    tags: Dict[str, str] = Field(default_factory=dict)
    logs: List[Dict[str, Any]] = Field(default_factory=list)


class ObservabilityModule(ABC):
    """
    Metrics, tracing, and logging.
    Provides visibility into agent behavior.
    """

    @abstractmethod
    async def log_event(
        self,
        level: str,
        message: str,
        context: Dict[str, Any] = None
    ) -> None:
        """Log an event."""
        pass

    @abstractmethod
    async def record_metric(
        self,
        name: str,
        value: float,
        tags: Dict[str, str] = None
    ) -> None:
        """Record a metric."""
        pass

    @abstractmethod
    async def start_span(
        self,
        operation_name: str,
        parent_span_id: Optional[str] = None
    ) -> Span:
        """Start a new tracing span."""
        pass

    @abstractmethod
    async def end_span(
        self,
        span: Span,
        status: str = "ok"
    ) -> None:
        """End a tracing span."""
        pass

    @abstractmethod
    async def get_metrics(
        self,
        metric_names: List[str],
        time_range_minutes: int = 60
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Get metrics for analysis."""
        pass
