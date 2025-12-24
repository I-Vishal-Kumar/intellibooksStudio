"""
Memory Manager for Research Agent

Handles saving and retrieving long-term memory for research sessions.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import logging
from pathlib import Path

from .backend import CompositeBackend, BackendProtocol

logger = logging.getLogger(__name__)


class MemoryManager:
    """
    Manages long-term memory for research agents.
    
    Handles saving:
    - Interaction history
    - User preferences
    - Research insights
    - Patterns discovered
    """
    
    def __init__(self, backend: BackendProtocol, session_id: str):
        """
        Initialize memory manager.
        
        Args:
            backend: CompositeBackend instance for memory storage
            session_id: Session ID for namespace isolation
        """
        self.backend = backend
        self.session_id = session_id
        self.interaction_count = 0
    
    def save_interaction(
        self,
        query: str,
        response: str,
        sources: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Save an interaction to memory.
        
        Args:
            query: User query
            response: Agent response
            sources: List of sources used
            metadata: Optional metadata (confidence, etc.)
        """
        try:
            # Load existing interaction history
            history_path = f"/memories/session_{self.session_id}/interaction_history.json"
            history = []
            
            try:
                history_content = self.backend.read(history_path)
                history = json.loads(history_content)
            except (FileNotFoundError, json.JSONDecodeError):
                # File doesn't exist or is invalid, start fresh
                history = []
            
            # Add new interaction
            interaction = {
                "timestamp": datetime.utcnow().isoformat(),
                "query": query,
                "response": response,
                "sources_count": len(sources),
                "sources": sources[:5],  # Store top 5 sources
                "metadata": metadata or {},
            }
            
            history.append(interaction)
            
            # Keep only last 100 interactions to prevent file from growing too large
            history = history[-100:]
            
            # Save updated history
            self.backend.write(history_path, json.dumps(history, indent=2))
            self.interaction_count += 1
            
            logger.info(f"💾 Saved interaction {self.interaction_count} to memory: {history_path}")
            
        except Exception as e:
            logger.error(f"Failed to save interaction to memory: {e}", exc_info=True)
    
    def save_preferences(
        self,
        preferences: Dict[str, Any],
    ) -> None:
        """
        Save user preferences.
        
        Args:
            preferences: Dictionary of user preferences
        """
        try:
            prefs_path = f"/memories/session_{self.session_id}/preferences.json"
            
            # Load existing preferences
            existing_prefs = {}
            try:
                prefs_content = self.backend.read(prefs_path)
                existing_prefs = json.loads(prefs_content)
            except (FileNotFoundError, json.JSONDecodeError):
                pass
            
            # Merge with new preferences
            existing_prefs.update(preferences)
            existing_prefs["last_updated"] = datetime.utcnow().isoformat()
            
            # Save
            self.backend.write(prefs_path, json.dumps(existing_prefs, indent=2))
            logger.info(f"💾 Saved preferences to memory: {prefs_path}")
            
        except Exception as e:
            logger.error(f"Failed to save preferences: {e}", exc_info=True)
    
    def save_insights(
        self,
        insights: Dict[str, Any],
    ) -> None:
        """
        Save research insights/policy insights.
        
        Args:
            insights: Dictionary of insights
        """
        try:
            insights_path = f"/memories/session_{self.session_id}/policy_insights.json"
            
            # Load existing insights
            existing_insights = {}
            try:
                insights_content = self.backend.read(insights_path)
                existing_insights = json.loads(insights_content)
            except (FileNotFoundError, json.JSONDecodeError):
                pass
            
            # Merge with new insights
            existing_insights.update(insights)
            existing_insights["last_updated"] = datetime.utcnow().isoformat()
            
            # Save
            self.backend.write(insights_path, json.dumps(existing_insights, indent=2))
            logger.info(f"💾 Saved insights to memory: {insights_path}")
            
        except Exception as e:
            logger.error(f"Failed to save insights: {e}", exc_info=True)
    
    def save_pattern(
        self,
        pattern_name: str,
        pattern_data: Dict[str, Any],
    ) -> None:
        """
        Save a discovered pattern to shared patterns directory.
        
        Args:
            pattern_name: Name of the pattern (e.g., "fraud_indicators")
            pattern_data: Pattern data
        """
        try:
            pattern_path = f"/memories/patterns/{pattern_name}.json"
            
            # Load existing patterns
            patterns = {}
            try:
                pattern_content = self.backend.read(pattern_path)
                patterns = json.loads(pattern_content)
            except (FileNotFoundError, json.JSONDecodeError):
                patterns = {}
            
            # Add new pattern entry
            pattern_entry = {
                "discovered_at": datetime.utcnow().isoformat(),
                "session_id": self.session_id,
                "data": pattern_data,
            }
            
            if "entries" not in patterns:
                patterns["entries"] = []
            patterns["entries"].append(pattern_entry)
            patterns["last_updated"] = datetime.utcnow().isoformat()
            
            # Save
            self.backend.write(pattern_path, json.dumps(patterns, indent=2))
            logger.info(f"💾 Saved pattern '{pattern_name}' to memory: {pattern_path}")
            
        except Exception as e:
            logger.error(f"Failed to save pattern: {e}", exc_info=True)
    
    def load_interaction_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Load recent interaction history.
        
        Args:
            limit: Maximum number of interactions to return
            
        Returns:
            List of recent interactions
        """
        try:
            history_path = f"/memories/session_{self.session_id}/interaction_history.json"
            history_content = self.backend.read(history_path)
            history = json.loads(history_content)
            return history[-limit:]
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def load_preferences(self) -> Dict[str, Any]:
        """
        Load user preferences.
        
        Returns:
            Dictionary of preferences
        """
        try:
            prefs_path = f"/memories/session_{self.session_id}/preferences.json"
            prefs_content = self.backend.read(prefs_path)
            return json.loads(prefs_content)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def get_conversation_summary(self) -> Optional[str]:
        """
        Generate a summary of the conversation history.
        
        Returns:
            Conversation summary or None
        """
        try:
            history = self.load_interaction_history(limit=20)
            if not history:
                return None
            
            # Simple summary: count interactions and topics
            total_interactions = len(history)
            recent_queries = [h.get("query", "") for h in history[-5:]]
            
            summary = f"Session has {total_interactions} interactions. Recent topics: {', '.join(recent_queries[:3])}"
            return summary
        except Exception as e:
            logger.error(f"Failed to generate conversation summary: {e}")
            return None

