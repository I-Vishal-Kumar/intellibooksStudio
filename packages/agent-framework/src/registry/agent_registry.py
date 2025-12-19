"""
Agent Registry - Discovery and management of agents.

The registry provides:
- Agent registration and discovery
- Health monitoring
- Capability-based agent selection
- Load balancing across agent instances
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import logging
from pydantic import BaseModel, Field

from ..identity import AgentIdentityCard, TrustLevel
from ..base import BaseAgent


class AgentRegistryEntry(BaseModel):
    """Entry in the agent registry."""

    agent_id: str
    name: str
    agent_type: str
    version: str
    domain: str
    trust_level: str
    skills: List[Dict[str, Any]]
    supported_actions: List[str]
    endpoint: Optional[str] = None  # For remote agents
    is_alive: bool = True
    last_heartbeat: Optional[datetime] = None
    registered_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentRegistry:
    """
    Registry for discovering and managing agents.

    Features:
    - Register local and remote agents
    - Discover agents by type, skill, or trust level
    - Health monitoring via heartbeats
    - Automatic cleanup of dead agents
    """

    def __init__(
        self,
        heartbeat_timeout_seconds: int = 60,
        cleanup_interval_seconds: int = 30,
    ):
        self._agents: Dict[str, AgentRegistryEntry] = {}
        self._local_agents: Dict[str, BaseAgent] = {}
        self._heartbeat_timeout = heartbeat_timeout_seconds
        self._cleanup_interval = cleanup_interval_seconds
        self._cleanup_task: Optional[asyncio.Task] = None
        self._logger = logging.getLogger("agent.registry")

    async def start(self) -> None:
        """Start the registry (begins cleanup task)."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._logger.info("Agent registry started")

    async def stop(self) -> None:
        """Stop the registry."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        self._logger.info("Agent registry stopped")

    async def register(
        self,
        agent: BaseAgent,
        endpoint: Optional[str] = None,
    ) -> str:
        """
        Register a local agent.

        Args:
            agent: The agent to register
            endpoint: Optional endpoint for remote access

        Returns:
            The agent's ID
        """
        entry = AgentRegistryEntry(
            agent_id=agent.agent_id,
            name=agent.name,
            agent_type=agent.identity.agent_type,
            version=agent.identity.version,
            domain=agent.identity.domain,
            trust_level=agent.identity.trust_level.value,
            skills=[
                {"name": s.name, "confidence": s.confidence_score}
                for s in agent.identity.capabilities.skills
            ],
            supported_actions=[a.value for a in agent.identity.supported_actions],
            endpoint=endpoint,
            is_alive=True,
            last_heartbeat=datetime.utcnow(),
        )

        self._agents[agent.agent_id] = entry
        self._local_agents[agent.agent_id] = agent

        self._logger.info(f"Registered agent: {agent.agent_id} ({agent.identity.agent_type})")
        return agent.agent_id

    async def register_remote(
        self,
        identity_card: AgentIdentityCard,
        endpoint: str,
    ) -> str:
        """
        Register a remote agent.

        Args:
            identity_card: The agent's identity card
            endpoint: The agent's endpoint URL

        Returns:
            The agent's ID
        """
        entry = AgentRegistryEntry(
            agent_id=identity_card.agent_id,
            name=identity_card.agent_id,
            agent_type=identity_card.agent_type,
            version=identity_card.version,
            domain=identity_card.domain,
            trust_level=identity_card.trust_level.value,
            skills=[
                {"name": s.name, "confidence": s.confidence_score}
                for s in identity_card.capabilities.skills
            ],
            supported_actions=[a.value for a in identity_card.supported_actions],
            endpoint=endpoint,
            is_alive=True,
            last_heartbeat=datetime.utcnow(),
        )

        self._agents[identity_card.agent_id] = entry

        self._logger.info(f"Registered remote agent: {identity_card.agent_id} at {endpoint}")
        return identity_card.agent_id

    async def unregister(self, agent_id: str) -> bool:
        """
        Unregister an agent.

        Args:
            agent_id: The agent's ID

        Returns:
            True if agent was unregistered, False if not found
        """
        if agent_id in self._agents:
            del self._agents[agent_id]
            self._local_agents.pop(agent_id, None)
            self._logger.info(f"Unregistered agent: {agent_id}")
            return True
        return False

    async def heartbeat(self, agent_id: str) -> bool:
        """
        Update an agent's heartbeat.

        Args:
            agent_id: The agent's ID

        Returns:
            True if heartbeat was recorded, False if agent not found
        """
        if agent_id in self._agents:
            self._agents[agent_id].last_heartbeat = datetime.utcnow()
            self._agents[agent_id].is_alive = True

            # Update local agent's heartbeat too
            if agent_id in self._local_agents:
                self._local_agents[agent_id].update_heartbeat()

            return True
        return False

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """Get a local agent by ID."""
        return self._local_agents.get(agent_id)

    def get_entry(self, agent_id: str) -> Optional[AgentRegistryEntry]:
        """Get a registry entry by agent ID."""
        return self._agents.get(agent_id)

    def list_agents(
        self,
        agent_type: Optional[str] = None,
        alive_only: bool = True,
    ) -> List[AgentRegistryEntry]:
        """
        List registered agents.

        Args:
            agent_type: Filter by agent type
            alive_only: Only return alive agents

        Returns:
            List of matching registry entries
        """
        results = list(self._agents.values())

        if agent_type:
            results = [a for a in results if a.agent_type == agent_type]

        if alive_only:
            results = [a for a in results if a.is_alive]

        return results

    def find_by_skill(
        self,
        skill_name: str,
        min_confidence: float = 0.0,
        alive_only: bool = True,
    ) -> List[AgentRegistryEntry]:
        """
        Find agents that have a specific skill.

        Args:
            skill_name: The skill to search for
            min_confidence: Minimum confidence score
            alive_only: Only return alive agents

        Returns:
            List of agents with the skill, sorted by confidence
        """
        results = []

        for entry in self._agents.values():
            if alive_only and not entry.is_alive:
                continue

            for skill in entry.skills:
                if skill["name"] == skill_name and skill["confidence"] >= min_confidence:
                    results.append((entry, skill["confidence"]))
                    break

        # Sort by confidence descending
        results.sort(key=lambda x: x[1], reverse=True)
        return [entry for entry, _ in results]

    def find_by_trust_level(
        self,
        min_trust_level: TrustLevel,
        alive_only: bool = True,
    ) -> List[AgentRegistryEntry]:
        """
        Find agents with at least the specified trust level.

        Args:
            min_trust_level: Minimum required trust level
            alive_only: Only return alive agents

        Returns:
            List of agents meeting the trust requirement
        """
        trust_hierarchy = {
            "untrusted": 0,
            "basic": 1,
            "verified": 2,
            "trusted": 3,
            "privileged": 4,
        }

        min_level = trust_hierarchy[min_trust_level.value]

        results = []
        for entry in self._agents.values():
            if alive_only and not entry.is_alive:
                continue

            entry_level = trust_hierarchy.get(entry.trust_level, 0)
            if entry_level >= min_level:
                results.append(entry)

        return results

    def select_best_agent(
        self,
        skill_name: str,
        min_confidence: float = 0.5,
        min_trust_level: Optional[TrustLevel] = None,
    ) -> Optional[BaseAgent]:
        """
        Select the best local agent for a skill.

        Args:
            skill_name: Required skill
            min_confidence: Minimum confidence score
            min_trust_level: Minimum trust level

        Returns:
            The best matching agent, or None
        """
        candidates = self.find_by_skill(skill_name, min_confidence)

        if min_trust_level:
            trust_candidates = self.find_by_trust_level(min_trust_level)
            trust_ids = {c.agent_id for c in trust_candidates}
            candidates = [c for c in candidates if c.agent_id in trust_ids]

        for entry in candidates:
            if entry.agent_id in self._local_agents:
                return self._local_agents[entry.agent_id]

        return None

    async def _cleanup_loop(self) -> None:
        """Background task to mark dead agents."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._mark_dead_agents()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._logger.error(f"Cleanup error: {e}")

    async def _mark_dead_agents(self) -> None:
        """Mark agents as dead if heartbeat timeout exceeded."""
        now = datetime.utcnow()
        dead_count = 0

        for entry in self._agents.values():
            if entry.last_heartbeat:
                elapsed = (now - entry.last_heartbeat).total_seconds()
                if elapsed > self._heartbeat_timeout and entry.is_alive:
                    entry.is_alive = False
                    dead_count += 1
                    self._logger.warning(f"Agent {entry.agent_id} marked as dead (no heartbeat)")

        if dead_count > 0:
            self._logger.info(f"Marked {dead_count} agents as dead")

    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        total = len(self._agents)
        alive = sum(1 for a in self._agents.values() if a.is_alive)
        local = len(self._local_agents)

        by_type = {}
        for entry in self._agents.values():
            by_type[entry.agent_type] = by_type.get(entry.agent_type, 0) + 1

        return {
            "total_agents": total,
            "alive_agents": alive,
            "dead_agents": total - alive,
            "local_agents": local,
            "remote_agents": total - local,
            "by_type": by_type,
        }


# Global registry instance
_registry: Optional[AgentRegistry] = None


def get_registry() -> AgentRegistry:
    """Get the global agent registry instance."""
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry


async def init_registry() -> AgentRegistry:
    """Initialize and start the global registry."""
    registry = get_registry()
    await registry.start()
    return registry
