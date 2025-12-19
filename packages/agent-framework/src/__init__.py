"""
@intellibooks/agent-framework

Agent Framework with Identity Cards and DNA Blueprint for Intellibooks Studio.

This package provides:
- Agent Identity Cards for identification and trust management
- DNA Blueprint for defining agent architecture layers
- Base agent class for building specialized agents
- Agent registry for discovery and management
"""

# Identity
from .identity import (
    AgentIdentityCard,
    CapabilitiesManifest,
    Skill,
    TrustLevel,
    ActionType,
)

# DNA Blueprint
from .dna import (
    AgentDNABlueprint,
    BlueprintBuilder,
    create_minimal_blueprint,
    create_standard_blueprint,
    create_full_blueprint,
    # Layers
    CognitiveLayer,
    KnowledgeLayer,
    ExecutionLayer,
    SafetyLayer,
    LearningLayer,
    SocialLayer,
    # Layer components
    ReasoningEngine,
    PlanningModule,
    ReflectionEngine,
    RAGEngine,
    GraphQueryEngine,
    MemoryStore,
    ToolUseModule,
    ActionExecutor,
    WorkflowEngine,
    Guardrails,
    ComplianceChecker,
    FeedbackProcessor,
    AdaptationEngine,
    A2ACommunication,
    DelegationManager,
    ObservabilityModule,
)

# Base
from .base import (
    BaseAgent,
    AgentResult,
    AgentContext,
)

# Registry
from .registry import (
    AgentRegistry,
    AgentRegistryEntry,
    get_registry,
    init_registry,
)

__version__ = "1.0.0"

__all__ = [
    # Identity
    "AgentIdentityCard",
    "CapabilitiesManifest",
    "Skill",
    "TrustLevel",
    "ActionType",

    # DNA Blueprint
    "AgentDNABlueprint",
    "BlueprintBuilder",
    "create_minimal_blueprint",
    "create_standard_blueprint",
    "create_full_blueprint",

    # Layers
    "CognitiveLayer",
    "KnowledgeLayer",
    "ExecutionLayer",
    "SafetyLayer",
    "LearningLayer",
    "SocialLayer",

    # Layer components
    "ReasoningEngine",
    "PlanningModule",
    "ReflectionEngine",
    "RAGEngine",
    "GraphQueryEngine",
    "MemoryStore",
    "ToolUseModule",
    "ActionExecutor",
    "WorkflowEngine",
    "Guardrails",
    "ComplianceChecker",
    "FeedbackProcessor",
    "AdaptationEngine",
    "A2ACommunication",
    "DelegationManager",
    "ObservabilityModule",

    # Base
    "BaseAgent",
    "AgentResult",
    "AgentContext",

    # Registry
    "AgentRegistry",
    "AgentRegistryEntry",
    "get_registry",
    "init_registry",
]
