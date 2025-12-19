"""
Base Agent - Foundation for all jAI agents.

Combines Identity Card and DNA Blueprint into a cohesive agent.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List, TypeVar, Generic, Callable, Union
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import uuid

try:
    # Try relative imports first (for package installation)
    from ..identity import (
        AgentIdentityCard,
        CapabilitiesManifest,
        Skill,
        TrustLevel,
        ActionType,
    )
    from ..dna import (
        AgentDNABlueprint,
        create_standard_blueprint,
    )
except ImportError:
    # Fall back to absolute imports (for direct path usage)
    from identity.card import (
        AgentIdentityCard,
        CapabilitiesManifest,
        Skill,
        TrustLevel,
        ActionType,
    )
    from dna.blueprint import (
        AgentDNABlueprint,
        create_standard_blueprint,
    )


# Type variable for agent result
T = TypeVar("T")


class AgentResult(BaseModel, Generic[T]):
    """Standard result from agent execution."""

    success: bool = Field(..., description="Whether execution succeeded")
    data: Optional[T] = Field(None, description="Result data on success")
    error: Optional[str] = Field(None, description="Error message on failure")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Execution info
    agent_id: str = Field(..., description="ID of agent that produced this result")
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None

    def mark_complete(self) -> None:
        """Mark the result as complete and calculate duration."""
        self.completed_at = datetime.utcnow()
        self.duration_ms = int(
            (self.completed_at - self.started_at).total_seconds() * 1000
        )


class AgentContext(BaseModel):
    """Context passed to agent during execution."""

    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    correlation_id: Optional[str] = None
    trace_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseAgent(ABC):
    """
    Base agent class with Identity Card and DNA Blueprint.

    All specialized agents inherit from this class.

    Features:
    - Identity Card for identification and capability declaration
    - DNA Blueprint for defining agent architecture
    - Standardized execution interface
    - Built-in logging and observability
    - Safety checks before execution

    Usage:
        class MyAgent(BaseAgent):
            async def execute(self, input_data, context):
                # Implementation
                pass

        agent = MyAgent(
            name="my-agent",
            agent_type="processor",
            version="1.0.0",
            skills=[Skill(name="process", confidence_score=0.9, ...)]
        )
    """

    def __init__(
        self,
        name: str,
        agent_type: str,
        version: str,
        skills: List[Skill],
        supported_actions: Optional[List[ActionType]] = None,
        trust_level: TrustLevel = TrustLevel.VERIFIED,
        domain: str = "audio-processing",
        environment: str = "development",
        dna_blueprint: Optional[AgentDNABlueprint] = None,
        # LLM configuration
        llm_instance: Optional[Any] = None,
        llm_settings: Optional[Dict[str, Any]] = None,
        default_temperature: float = 0.7,
        **kwargs,
    ):
        """
        Initialize a base agent.

        Args:
            name: Human-readable name for the agent
            agent_type: Type of agent (transcription, translation, etc.)
            version: Semantic version string
            skills: List of skills this agent possesses
            supported_actions: Actions this agent can perform
            trust_level: Trust level for this agent
            domain: Operational domain
            environment: Deployment environment
            dna_blueprint: Optional DNA blueprint (uses standard if not provided)
            llm_instance: Optional pre-configured LLM instance to use
            llm_settings: Optional dict with LLM configuration:
                - provider: "openai", "anthropic", or "openrouter"
                - api_key: API key for the provider
                - model: Model name
                - base_url: Optional base URL (for OpenRouter)
            default_temperature: Default temperature for LLM (can be overridden per agent)
        """
        self.name = name
        self.logger = logging.getLogger(f"agent.{name}")

        # Create identity card
        self._identity = self._create_identity_card(
            agent_type=agent_type,
            version=version,
            skills=skills,
            supported_actions=supported_actions or [ActionType.READ, ActionType.EXECUTE],
            trust_level=trust_level,
            domain=domain,
            environment=environment,
        )

        # Set DNA blueprint
        self._dna = dna_blueprint or create_standard_blueprint()

        # LLM configuration
        self._llm_instance = llm_instance
        self._llm_settings = llm_settings or {}
        self._default_temperature = default_temperature
        self._llm = None  # Lazy-loaded LLM instance

        # Execution state
        self._is_initialized = False
        self._execution_count = 0

    def _create_identity_card(
        self,
        agent_type: str,
        version: str,
        skills: List[Skill],
        supported_actions: List[ActionType],
        trust_level: TrustLevel,
        domain: str,
        environment: str,
    ) -> AgentIdentityCard:
        """Create the agent's identity card."""
        agent_id = AgentIdentityCard.generate_agent_id(
            agent_type=agent_type,
            version=version,
            environment=environment,
        )

        return AgentIdentityCard(
            agent_id=agent_id,
            agent_type=agent_type,
            domain=domain,
            version=version,
            capabilities=CapabilitiesManifest(skills=skills),
            supported_actions=supported_actions,
            trust_level=trust_level,
            environment=environment,
        )

    @property
    def identity(self) -> AgentIdentityCard:
        """Get the agent's identity card."""
        return self._identity

    @property
    def agent_id(self) -> str:
        """Get the agent's unique ID."""
        return self._identity.agent_id

    @property
    def dna(self) -> AgentDNABlueprint:
        """Get the agent's DNA blueprint."""
        return self._dna

    def _create_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None) -> Any:
        """
        Create an LLM instance.
        
        This method can be overridden by subclasses to customize LLM creation.
        By default, it creates an LLM based on llm_settings or uses the provided llm_instance.
        
        Args:
            temperature: Temperature for the LLM (uses default_temperature if not provided)
            structured_output: Optional Pydantic model for structured output
            
        Returns:
            LLM instance
        """
        # If a pre-configured LLM instance was provided, use it
        if self._llm_instance is not None:
            if structured_output is not None:
                return self._llm_instance.with_structured_output(structured_output)
            return self._llm_instance
        
        # Otherwise, create LLM from settings
        if not self._llm_settings:
            raise ValueError(
                "No LLM instance or settings provided. "
                "Either pass llm_instance or llm_settings to __init__."
            )
        
        provider = self._llm_settings.get("provider", "openrouter")
        api_key = self._llm_settings.get("api_key", "")
        model = self._llm_settings.get("model", "gpt-4o")
        base_url = self._llm_settings.get("base_url")
        temp = temperature if temperature is not None else self._default_temperature
        
        # Import LLM classes (lazy import to avoid dependency issues)
        try:
            if provider == "openai":
                from langchain_openai import ChatOpenAI  # type: ignore
                llm = ChatOpenAI(
                    model=model,
                    api_key=api_key,
                    temperature=temp,
                )
            elif provider == "anthropic":
                from langchain_anthropic import ChatAnthropic  # type: ignore
                llm = ChatAnthropic(
                    model=model,
                    api_key=api_key,
                    temperature=temp,
                )
            else:  # openrouter or default
                from langchain_openai import ChatOpenAI  # type: ignore
                llm = ChatOpenAI(
                    model=model,
                    api_key=api_key,
                    base_url=base_url or "https://openrouter.ai/api/v1",
                    temperature=temp,
                )
            
            # Apply structured output if requested
            if structured_output is not None:
                return llm.with_structured_output(structured_output)
            
            return llm
            
        except ImportError as e:
            raise ImportError(
                f"Failed to import LLM library. Make sure langchain-openai or langchain-anthropic is installed. {e}"
            )

    @property
    def llm(self) -> Any:
        """
        Get the LLM instance (lazy-loaded).
        
        Override _create_llm() to customize LLM creation, or use get_llm()
        with specific parameters for structured output or custom temperature.
        """
        if self._llm is None:
            self._llm = self._create_llm()
        return self._llm

    def get_llm(self, temperature: Optional[float] = None, structured_output: Optional[Any] = None) -> Any:
        """
        Get an LLM instance with custom parameters.
        
        Use this method when you need an LLM with specific temperature or structured output.
        This creates a new instance each time (doesn't cache).
        
        Args:
            temperature: Temperature for the LLM
            structured_output: Optional Pydantic model for structured output
            
        Returns:
            LLM instance
        """
        return self._create_llm(temperature=temperature, structured_output=structured_output)

    async def initialize(self) -> None:
        """
        Initialize the agent.

        Override this method to perform any setup tasks.
        Called automatically before first execution.
        """
        self._is_initialized = True
        self.logger.info(f"Agent {self.agent_id} initialized")

    async def shutdown(self) -> None:
        """
        Shutdown the agent.

        Override this method to perform cleanup tasks.
        """
        self._is_initialized = False
        self.logger.info(f"Agent {self.agent_id} shutdown")

    @abstractmethod
    async def execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Execute the agent's primary function.

        Args:
            input_data: Input data for the agent
            context: Execution context

        Returns:
            AgentResult with execution outcome
        """
        pass

    async def safe_execute(
        self,
        input_data: Any,
        context: Optional[AgentContext] = None,
    ) -> AgentResult:
        """
        Execute with safety checks and observability.

        This is the recommended entry point for agent execution.
        It wraps execute() with:
        - Initialization check
        - Safety layer validation (if available)
        - Error handling
        - Metrics recording
        - Audit logging
        """
        context = context or AgentContext()

        # Ensure initialized
        if not self._is_initialized:
            await self.initialize()

        # Start timing
        result = AgentResult(
            success=False,
            agent_id=self.agent_id,
            metadata={"request_id": context.request_id},
        )

        try:
            # Safety check on input (if safety layer is configured)
            if self._dna.safety.guardrails:
                safety_result = await self._dna.safety.guardrails.validate_input(input_data)
                if not safety_result.passed:
                    result.error = f"Input validation failed: {safety_result.violations}"
                    result.mark_complete()
                    return result

            # Log start (if observability is configured)
            if self._dna.observability:
                await self._dna.observability.log_event(
                    level="info",
                    message=f"Executing agent {self.agent_id}",
                    context={"request_id": context.request_id},
                )

            # Execute
            result = await self.execute(input_data, context)

            # Safety check on output (if configured)
            if self._dna.safety.guardrails and result.success and result.data:
                safety_result = await self._dna.safety.guardrails.validate_output(result.data)
                if not safety_result.passed:
                    result.success = False
                    result.error = f"Output validation failed: {safety_result.violations}"

            # Compliance audit (if configured)
            if self._dna.safety.compliance:
                try:
                    from ..dna import AuditEntry
                except ImportError:
                    from dna.layers import AuditEntry
                await self._dna.safety.compliance.audit_log(AuditEntry(
                    agent_id=self.agent_id,
                    action="execute",
                    outcome="success" if result.success else "failure",
                    details={
                        "request_id": context.request_id,
                        "duration_ms": result.duration_ms,
                    },
                ))

        except Exception as e:
            self.logger.exception(f"Agent execution failed: {e}")
            result.error = str(e)
            result.mark_complete()

            # Log error (if observability is configured)
            if self._dna.observability:
                await self._dna.observability.log_event(
                    level="error",
                    message=f"Agent {self.agent_id} execution failed",
                    context={
                        "request_id": context.request_id,
                        "error": str(e),
                    },
                )

        self._execution_count += 1
        return result

    def update_heartbeat(self) -> None:
        """Update the agent's heartbeat timestamp."""
        self._identity.update_heartbeat()

    def can_handle(self, task: str) -> bool:
        """Check if the agent can handle a specific task."""
        return self._identity.has_skill(task)

    def get_skill_confidence(self, skill: str) -> float:
        """Get confidence score for a skill."""
        return self._identity.get_skill_confidence(skill)

    def to_registry_entry(self) -> Dict[str, Any]:
        """Convert agent info to registry entry format."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "agent_type": self._identity.agent_type,
            "version": self._identity.version,
            "domain": self._identity.domain,
            "trust_level": self._identity.trust_level.value,
            "skills": [
                {
                    "name": s.name,
                    "confidence": s.confidence_score,
                }
                for s in self._identity.capabilities.skills
            ],
            "supported_actions": [a.value for a in self._identity.supported_actions],
            "is_alive": self._identity.is_alive(),
            "last_heartbeat": self._identity.last_heartbeat.isoformat() if self._identity.last_heartbeat else None,
            "execution_count": self._execution_count,
            "dna_layers": self._dna.get_enabled_layers(),
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.agent_id} type={self._identity.agent_type}>"
