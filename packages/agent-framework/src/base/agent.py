"""
Base Agent - Foundation for all jAI agents.

Combines Identity Card and DNA Blueprint into a cohesive agent.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List, TypeVar, Generic
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import uuid

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
                from ..dna import AuditEntry
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
