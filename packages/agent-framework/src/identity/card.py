"""
Agent Identity Card - Core identification and trust mechanism for agents.

The Identity Card provides:
- Unique agent identification
- Capabilities manifest with confidence scores
- Trust level management
- Digital signature verification
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
import hashlib
import json
import uuid


class TrustLevel(str, Enum):
    """Trust levels for agents, from least to most privileged."""
    UNTRUSTED = "untrusted"      # No trust, requires human approval for all actions
    BASIC = "basic"              # Basic operations, read-only access
    VERIFIED = "verified"        # Verified agent, can perform standard operations
    TRUSTED = "trusted"          # Trusted agent, can perform sensitive operations
    PRIVILEGED = "privileged"    # Full access, can delegate to other agents


class ActionType(str, Enum):
    """Types of actions an agent can perform."""
    READ = "READ"
    WRITE = "WRITE"
    EXECUTE = "EXECUTE"
    DELETE = "DELETE"
    DELEGATE = "DELEGATE"
    ADMIN = "ADMIN"


class Skill(BaseModel):
    """A capability/skill that an agent possesses."""

    name: str = Field(..., description="Name of the skill (e.g., 'transcription', 'translation')")
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence level for this skill (0.0 to 1.0)"
    )
    input_types: List[str] = Field(
        default_factory=list,
        description="Types of input this skill accepts"
    )
    output_types: List[str] = Field(
        default_factory=list,
        description="Types of output this skill produces"
    )
    description: Optional[str] = Field(
        None,
        description="Human-readable description of the skill"
    )
    version: str = Field(
        default="1.0.0",
        description="Version of this skill implementation"
    )


class CapabilitiesManifest(BaseModel):
    """Manifest of all capabilities an agent possesses."""

    skills: List[Skill] = Field(
        default_factory=list,
        description="List of skills this agent can perform"
    )
    supported_languages: List[str] = Field(
        default_factory=list,
        description="Languages this agent can work with"
    )
    max_input_size: Optional[int] = Field(
        None,
        description="Maximum input size in bytes"
    )
    supported_formats: List[str] = Field(
        default_factory=list,
        description="File formats this agent supports"
    )
    rate_limit: Optional[int] = Field(
        None,
        description="Maximum requests per minute"
    )

    def has_skill(self, skill_name: str) -> bool:
        """Check if agent has a specific skill."""
        return any(s.name == skill_name for s in self.skills)

    def get_skill(self, skill_name: str) -> Optional[Skill]:
        """Get a skill by name."""
        for skill in self.skills:
            if skill.name == skill_name:
                return skill
        return None

    def get_skill_confidence(self, skill_name: str) -> float:
        """Get confidence score for a specific skill."""
        skill = self.get_skill(skill_name)
        return skill.confidence_score if skill else 0.0


class AgentIdentityCard(BaseModel):
    """
    Agent Identity Card - Core identification for jAI agents.

    Structure:
    ┌──────────────────────────────────────────────────────────────────────┐
    │                       AGENT IDENTITY CARD                            │
    ├──────────────────────────────────────────────────────────────────────┤
    │  Agent ID:        jai-claims-agent-v2.1.0-prod-a1b2c3d4             │
    │  Agent Type:      Domain Specialist                                  │
    │  Domain:          Insurance Claims Processing                        │
    │  Version:         2.1.0                                              │
    │  ┌────────────────────────────────────────────────────────────────┐ │
    │  │  CAPABILITIES MANIFEST                                         │ │
    │  │  Primary Skills:                                                │ │
    │  │  • claim_validation (confidence: 0.95)                          │ │
    │  │  • settlement_calculation (confidence: 0.92)                    │ │
    │  │  Supported Actions: READ, WRITE, EXECUTE                        │ │
    │  │  Trust Level: LEVEL_4 (financial up to $100K)                   │ │
    │  └────────────────────────────────────────────────────────────────┘ │
    │  Digital Signature: sha256:9f86d081884c7d659a2feaa0c55ad015...      │
    └──────────────────────────────────────────────────────────────────────┘
    """

    # Core Identity
    agent_id: str = Field(
        ...,
        description="Unique agent identifier (format: jai-{type}-{version}-{env}-{uuid})"
    )
    agent_type: str = Field(
        ...,
        description="Type of agent (e.g., transcription, translation, orchestrator)"
    )
    domain: str = Field(
        default="audio-processing",
        description="Operational domain of the agent"
    )
    version: str = Field(
        ...,
        pattern=r'^\d+\.\d+\.\d+$',
        description="Semantic version of the agent"
    )

    # Capabilities
    capabilities: CapabilitiesManifest = Field(
        default_factory=CapabilitiesManifest,
        description="Manifest of agent capabilities"
    )
    supported_actions: List[ActionType] = Field(
        default_factory=lambda: [ActionType.READ, ActionType.EXECUTE],
        description="Actions this agent is authorized to perform"
    )

    # Trust & Security
    trust_level: TrustLevel = Field(
        default=TrustLevel.BASIC,
        description="Trust level of the agent"
    )
    digital_signature: Optional[str] = Field(
        None,
        description="SHA-256 digital signature for verification"
    )

    # Metadata
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the agent was created"
    )
    last_heartbeat: Optional[datetime] = Field(
        None,
        description="Last heartbeat timestamp"
    )
    owner: Optional[str] = Field(
        None,
        description="Owner/creator of the agent"
    )
    environment: str = Field(
        default="development",
        description="Deployment environment (development, staging, production)"
    )

    @classmethod
    def generate_agent_id(
        cls,
        agent_type: str,
        version: str,
        environment: str = "dev"
    ) -> str:
        """Generate a unique agent ID."""
        short_uuid = str(uuid.uuid4()).replace("-", "")[:8]
        env_prefix = {
            "development": "dev",
            "staging": "stg",
            "production": "prod"
        }.get(environment, "dev")
        return f"jai-{agent_type}-v{version}-{env_prefix}-{short_uuid}"

    def sign(self, private_key: str) -> None:
        """
        Sign the identity card with a private key.
        Creates a SHA-256 hash of the card contents.
        """
        payload = self._get_signable_payload()
        signature_input = payload + private_key
        self.digital_signature = f"sha256:{hashlib.sha256(signature_input.encode()).hexdigest()}"

    def verify_signature(self, public_key: str) -> bool:
        """
        Verify the digital signature.

        In a production system, this would use asymmetric cryptography.
        For now, uses symmetric verification for simplicity.
        """
        if not self.digital_signature:
            return False

        payload = self._get_signable_payload()
        signature_input = payload + public_key
        expected = f"sha256:{hashlib.sha256(signature_input.encode()).hexdigest()}"
        return self.digital_signature == expected

    def _get_signable_payload(self) -> str:
        """Get the JSON payload for signing (excludes signature field)."""
        data = self.model_dump(exclude={"digital_signature", "last_heartbeat"})
        # Convert datetime to ISO format for consistent hashing
        data["created_at"] = self.created_at.isoformat()
        return json.dumps(data, sort_keys=True)

    def can_perform(self, action: ActionType) -> bool:
        """Check if agent can perform an action."""
        return action in self.supported_actions

    def has_skill(self, skill_name: str) -> bool:
        """Check if agent has a specific skill."""
        return self.capabilities.has_skill(skill_name)

    def get_skill_confidence(self, skill_name: str) -> float:
        """Get confidence score for a specific skill."""
        return self.capabilities.get_skill_confidence(skill_name)

    def is_trusted_for(self, required_level: TrustLevel) -> bool:
        """Check if agent's trust level meets the requirement."""
        trust_hierarchy = {
            TrustLevel.UNTRUSTED: 0,
            TrustLevel.BASIC: 1,
            TrustLevel.VERIFIED: 2,
            TrustLevel.TRUSTED: 3,
            TrustLevel.PRIVILEGED: 4,
        }
        return trust_hierarchy[self.trust_level] >= trust_hierarchy[required_level]

    def update_heartbeat(self) -> None:
        """Update the last heartbeat timestamp."""
        self.last_heartbeat = datetime.utcnow()

    def is_alive(self, timeout_seconds: int = 60) -> bool:
        """Check if agent is alive based on heartbeat."""
        if not self.last_heartbeat:
            return False
        elapsed = (datetime.utcnow() - self.last_heartbeat).total_seconds()
        return elapsed < timeout_seconds

    def to_display_card(self) -> str:
        """Generate a human-readable display card."""
        skills_display = "\n".join(
            f"    • {s.name} (confidence: {s.confidence_score:.2f})"
            for s in self.capabilities.skills
        )
        actions_display = ", ".join(a.value for a in self.supported_actions)

        return f"""
┌──────────────────────────────────────────────────────────────────────┐
│                       AGENT IDENTITY CARD                            │
├──────────────────────────────────────────────────────────────────────┤
│  Agent ID:        {self.agent_id:<52}│
│  Agent Type:      {self.agent_type:<52}│
│  Domain:          {self.domain:<52}│
│  Version:         {self.version:<52}│
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  CAPABILITIES MANIFEST                                         │ │
│  │  Primary Skills:                                                │ │
{skills_display}
│  │  Supported Actions: {actions_display:<46}│ │
│  │  Trust Level: {self.trust_level.value:<52}│ │
│  └────────────────────────────────────────────────────────────────┘ │
│  Digital Signature: {(self.digital_signature or 'Not signed')[:48]:<48}│
└──────────────────────────────────────────────────────────────────────┘
"""
