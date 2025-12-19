"""
Agent DNA Blueprint - Complete Agent Architecture

The DNA Blueprint brings together all layers into a cohesive agent architecture.

┌─────────────────────────────────────────────────────────────────────────┐
│                        jAI AGENT DNA BLUEPRINT                          │
├─────────────────────────────────────────────────────────────────────────┤
│                            ┌─────────────────┐                          │
│                            │   AGENT CORE    │                          │
│                            │    IDENTITY     │                          │
│                            └────────┬────────┘                          │
│        ┌────────────────────────────┼────────────────────────────┐      │
│        ▼                            ▼                            ▼      │
│ ┌───────────────┐          ┌───────────────┐          ┌───────────────┐│
│ │  COGNITIVE    │          │  KNOWLEDGE    │          │  EXECUTION    ││
│ │  LAYER        │          │  LAYER        │          │  LAYER        ││
│ │ • Reasoning   │          │ • RAG Engine  │          │ • Tool Use    ││
│ │ • Planning    │          │ • Graph Query │          │ • Actions     ││
│ │ • Reflection  │          │ • Memory      │          │ • Workflows   ││
│ └───────────────┘          └───────────────┘          └───────────────┘│
│        │                            │                            │      │
│        └────────────────────────────┼────────────────────────────┘      │
│        ┌────────────────────────────┼────────────────────────────┐      │
│        ▼                            ▼                            ▼      │
│ ┌───────────────┐          ┌───────────────┐          ┌───────────────┐│
│ │  SAFETY       │          │  LEARNING     │          │  SOCIAL       ││
│ │  LAYER        │          │  LAYER        │          │  LAYER        ││
│ │ • Guardrails  │          │ • Feedback    │          │ • A2A Comms   ││
│ │ • Compliance  │          │ • Adaptation  │          │ • Delegation  ││
│ └───────────────┘          └───────────────┘          └───────────────┘│
│                            ┌─────────────────┐                          │
│                            │  OBSERVABILITY  │                          │
│                            └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime

from .layers import (
    CognitiveLayer,
    KnowledgeLayer,
    ExecutionLayer,
    SafetyLayer,
    LearningLayer,
    SocialLayer,
    ObservabilityModule,
)


class AgentDNABlueprint(BaseModel):
    """
    Complete Agent DNA Blueprint containing all layers.

    The blueprint defines the complete capabilities and behavior
    of an agent. Each layer can be configured independently,
    allowing for flexible agent composition.

    Layers:
    1. Cognitive Layer (Reasoning, Planning, Reflection)
    2. Knowledge Layer (RAG Engine, Graph Query, Memory)
    3. Execution Layer (Tool Use, Actions, Workflows)
    4. Safety Layer (Guardrails, Compliance)
    5. Learning Layer (Feedback, Adaptation)
    6. Social Layer (A2A Comms, Delegation)
    7. Observability (Metrics, Tracing, Logging)
    """

    class Config:
        arbitrary_types_allowed = True

    # Core layers
    cognitive: CognitiveLayer = Field(
        default_factory=CognitiveLayer,
        description="Cognitive capabilities: reasoning, planning, reflection"
    )
    knowledge: KnowledgeLayer = Field(
        default_factory=KnowledgeLayer,
        description="Knowledge management: RAG, graph queries, memory"
    )
    execution: ExecutionLayer = Field(
        default_factory=ExecutionLayer,
        description="Execution capabilities: tools, actions, workflows"
    )
    safety: SafetyLayer = Field(
        default_factory=SafetyLayer,
        description="Safety controls: guardrails, compliance"
    )
    learning: LearningLayer = Field(
        default_factory=LearningLayer,
        description="Learning capabilities: feedback, adaptation"
    )
    social: SocialLayer = Field(
        default_factory=SocialLayer,
        description="Social capabilities: A2A communication, delegation"
    )
    observability: Optional[ObservabilityModule] = Field(
        None,
        description="Observability: metrics, tracing, logging"
    )

    # Configuration
    version: str = Field(default="1.0.0", description="Blueprint version")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def get_enabled_layers(self) -> List[str]:
        """Get list of enabled (non-empty) layers."""
        enabled = []

        if self.cognitive.reasoning or self.cognitive.planning or self.cognitive.reflection:
            enabled.append("cognitive")

        if self.knowledge.rag_engine or self.knowledge.graph_query or self.knowledge.memory:
            enabled.append("knowledge")

        if self.execution.tool_use or self.execution.actions or self.execution.workflows:
            enabled.append("execution")

        if self.safety.guardrails or self.safety.compliance:
            enabled.append("safety")

        if self.learning.feedback or self.learning.adaptation:
            enabled.append("learning")

        if self.social.communication or self.social.delegation:
            enabled.append("social")

        if self.observability:
            enabled.append("observability")

        return enabled

    def get_capabilities_summary(self) -> Dict[str, List[str]]:
        """Get a summary of all enabled capabilities by layer."""
        summary = {}

        # Cognitive
        cognitive_caps = []
        if self.cognitive.reasoning:
            cognitive_caps.append("reasoning")
        if self.cognitive.planning:
            cognitive_caps.append("planning")
        if self.cognitive.reflection:
            cognitive_caps.append("reflection")
        if cognitive_caps:
            summary["cognitive"] = cognitive_caps

        # Knowledge
        knowledge_caps = []
        if self.knowledge.rag_engine:
            knowledge_caps.append("rag_engine")
        if self.knowledge.graph_query:
            knowledge_caps.append("graph_query")
        if self.knowledge.memory:
            knowledge_caps.append("memory")
        if knowledge_caps:
            summary["knowledge"] = knowledge_caps

        # Execution
        execution_caps = []
        if self.execution.tool_use:
            execution_caps.append("tool_use")
        if self.execution.actions:
            execution_caps.append("actions")
        if self.execution.workflows:
            execution_caps.append("workflows")
        if execution_caps:
            summary["execution"] = execution_caps

        # Safety
        safety_caps = []
        if self.safety.guardrails:
            safety_caps.append("guardrails")
        if self.safety.compliance:
            safety_caps.append("compliance")
        if safety_caps:
            summary["safety"] = safety_caps

        # Learning
        learning_caps = []
        if self.learning.feedback:
            learning_caps.append("feedback")
        if self.learning.adaptation:
            learning_caps.append("adaptation")
        if learning_caps:
            summary["learning"] = learning_caps

        # Social
        social_caps = []
        if self.social.communication:
            social_caps.append("a2a_communication")
        if self.social.delegation:
            social_caps.append("delegation")
        if social_caps:
            summary["social"] = social_caps

        # Observability
        if self.observability:
            summary["observability"] = ["metrics", "tracing", "logging"]

        return summary

    def validate_for_task(self, required_capabilities: List[str]) -> Dict[str, Any]:
        """
        Validate if the blueprint has all required capabilities for a task.

        Args:
            required_capabilities: List of required capability names

        Returns:
            Dict with 'valid' bool and 'missing' list
        """
        all_caps = []
        summary = self.get_capabilities_summary()
        for layer_caps in summary.values():
            all_caps.extend(layer_caps)

        missing = [cap for cap in required_capabilities if cap not in all_caps]

        return {
            "valid": len(missing) == 0,
            "missing": missing,
            "available": all_caps,
        }

    def to_display(self) -> str:
        """Generate a human-readable display of the blueprint."""
        summary = self.get_capabilities_summary()

        output = """
┌─────────────────────────────────────────────────────────────────────────┐
│                        jAI AGENT DNA BLUEPRINT                          │
├─────────────────────────────────────────────────────────────────────────┤
"""

        for layer, caps in summary.items():
            caps_str = ", ".join(caps)
            output += f"│  {layer.upper():<15} │ {caps_str:<52}│\n"

        output += """└─────────────────────────────────────────────────────────────────────────┘"""

        return output


class BlueprintBuilder:
    """Builder pattern for creating Agent DNA Blueprints."""

    def __init__(self):
        self._blueprint = AgentDNABlueprint()

    def with_cognitive(
        self,
        reasoning=None,
        planning=None,
        reflection=None
    ) -> "BlueprintBuilder":
        """Add cognitive layer components."""
        self._blueprint.cognitive = CognitiveLayer(
            reasoning=reasoning,
            planning=planning,
            reflection=reflection,
        )
        return self

    def with_knowledge(
        self,
        rag_engine=None,
        graph_query=None,
        memory=None
    ) -> "BlueprintBuilder":
        """Add knowledge layer components."""
        self._blueprint.knowledge = KnowledgeLayer(
            rag_engine=rag_engine,
            graph_query=graph_query,
            memory=memory,
        )
        return self

    def with_execution(
        self,
        tool_use=None,
        actions=None,
        workflows=None
    ) -> "BlueprintBuilder":
        """Add execution layer components."""
        self._blueprint.execution = ExecutionLayer(
            tool_use=tool_use,
            actions=actions,
            workflows=workflows,
        )
        return self

    def with_safety(
        self,
        guardrails=None,
        compliance=None
    ) -> "BlueprintBuilder":
        """Add safety layer components."""
        self._blueprint.safety = SafetyLayer(
            guardrails=guardrails,
            compliance=compliance,
        )
        return self

    def with_learning(
        self,
        feedback=None,
        adaptation=None
    ) -> "BlueprintBuilder":
        """Add learning layer components."""
        self._blueprint.learning = LearningLayer(
            feedback=feedback,
            adaptation=adaptation,
        )
        return self

    def with_social(
        self,
        communication=None,
        delegation=None
    ) -> "BlueprintBuilder":
        """Add social layer components."""
        self._blueprint.social = SocialLayer(
            communication=communication,
            delegation=delegation,
        )
        return self

    def with_observability(self, observability) -> "BlueprintBuilder":
        """Add observability module."""
        self._blueprint.observability = observability
        return self

    def build(self) -> AgentDNABlueprint:
        """Build and return the blueprint."""
        return self._blueprint


# Pre-defined blueprint templates

def create_minimal_blueprint() -> AgentDNABlueprint:
    """Create a minimal blueprint with just execution capabilities."""
    return AgentDNABlueprint(
        execution=ExecutionLayer(),
    )


def create_standard_blueprint() -> AgentDNABlueprint:
    """Create a standard blueprint with common capabilities."""
    return AgentDNABlueprint(
        cognitive=CognitiveLayer(),
        knowledge=KnowledgeLayer(),
        execution=ExecutionLayer(),
        safety=SafetyLayer(),
    )


def create_full_blueprint() -> AgentDNABlueprint:
    """Create a full blueprint with all layer placeholders."""
    return AgentDNABlueprint(
        cognitive=CognitiveLayer(),
        knowledge=KnowledgeLayer(),
        execution=ExecutionLayer(),
        safety=SafetyLayer(),
        learning=LearningLayer(),
        social=SocialLayer(),
    )
