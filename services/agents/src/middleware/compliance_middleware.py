"""
Compliance Middleware for Deep Agents

Implements before_model, modify_request, and after_model hooks to ensure
regulatory compliance in agent responses.
"""

from typing import Any, Dict, List, Optional, Callable
import logging
import re
import asyncio

try:
    from langchain.agents.factory import AgentMiddleware
    from langchain_core.messages import ToolMessage
    from langchain_core.runnables import RunnableConfig
    from typing import TYPE_CHECKING
    if TYPE_CHECKING:
        from langgraph.runtime import Runtime
    AGENT_MIDDLEWARE_AVAILABLE = True
except ImportError:
    try:
        from langchain.agents import AgentMiddleware
        from langchain_core.messages import ToolMessage
        from langchain_core.runnables import RunnableConfig
        from typing import TYPE_CHECKING
        if TYPE_CHECKING:
            from langgraph.runtime import Runtime
        AGENT_MIDDLEWARE_AVAILABLE = True
    except ImportError:
        AGENT_MIDDLEWARE_AVAILABLE = False
        AgentMiddleware = object  # Fallback
        ToolMessage = None
        RunnableConfig = None
        Runtime = None

logger = logging.getLogger(__name__)


class ComplianceMiddleware(AgentMiddleware):
    """
    Middleware that validates agent responses for regulatory compliance.
    
    Implements the deepagents middleware interface with:
    - before_model: Inject compliance context
    - modify_request: Add compliance instructions to system prompt
    - after_model: Validate response for prohibited language/patterns
    """
    
    # Prohibited terms and patterns for compliance checking
    PROHIBITED_TERMS = [
        r'\bguarantee\b.*\bprofit\b',
        r'\bguarantee\b.*\breturn\b',
        r'\brisk-free\b',
        r'\bno risk\b',
        r'\bguaranteed.*\bwin\b',
    ]
    
    # Fair lending violation patterns
    FAIR_LENDING_VIOLATIONS = [
        r'\bdeny\b.*\b(because|due to|based on)\b.*\b(race|religion|gender|age|nationality)\b',
        r'\bprefer\b.*\b(because|due to)\b.*\b(race|religion|gender|age|nationality)\b',
    ]
    
    def __init__(
        self,
        strict_mode: bool = True,
        log_violations: bool = True,
    ):
        """
        Initialize compliance middleware.
        
        Args:
            strict_mode: If True, modify responses that violate compliance
            log_violations: If True, log all compliance violations
        """
        # Initialize parent class if AgentMiddleware is available
        if AGENT_MIDDLEWARE_AVAILABLE and AgentMiddleware != object:
            super().__init__()
        
        self.strict_mode = strict_mode
        self.log_violations = log_violations
        self.violation_count = 0
        
    def before_model(
        self,
        state: Dict[str, Any],
        runtime: Any = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Called before LLM invocation.
        
        Use cases:
        - Inject RAG context
        - Query Knowledge Graph
        - Load user preferences
        
        Args:
            state: Current agent state
            config: Optional configuration
            
        Returns:
            Modified state (if needed)
        """
        # Inject compliance context into state if needed
        # For now, we'll add compliance flags to metadata
        if "metadata" not in state:
            state["metadata"] = {}
        
        state["metadata"]["compliance_check"] = True
        state["metadata"]["compliance_strict_mode"] = self.strict_mode
        
        logger.debug("ComplianceMiddleware.before_model: Compliance context injected")
        
        return state
    
    def modify_request(
        self,
        messages: List[Dict[str, Any]],
        state: Optional[Dict[str, Any]] = None,
        runtime: Any = None,
    ) -> List[Dict[str, Any]]:
        """
        Transform request before sending to LLM.
        
        Use cases:
        - Add tools dynamically
        - Modify system prompt
        - Inject examples
        
        Args:
            messages: List of messages to send to LLM
            config: Optional configuration
            
        Returns:
            Modified messages list
        """
        # Find system message and add compliance instructions
        compliance_instructions = """
## Compliance Guidelines

You must ensure all responses comply with regulatory requirements:

1. **No Guarantees**: Never guarantee profits, returns, or risk-free investments
2. **Fair Lending**: Do not make decisions based on protected characteristics (race, religion, gender, age, nationality)
3. **Transparency**: Clearly state risks and limitations
4. **Accuracy**: Provide accurate, verifiable information

If you are unsure about compliance, err on the side of caution and provide disclaimers.
"""
        
        # Modify system message if present
        for message in messages:
            if message.get("role") == "system":
                current_content = message.get("content", "")
                if "Compliance Guidelines" not in current_content:
                    message["content"] = current_content + "\n\n" + compliance_instructions
                    logger.debug("ComplianceMiddleware.modify_request: Added compliance instructions")
                break
        else:
            # No system message found, add one
            messages.insert(0, {
                "role": "system",
                "content": compliance_instructions
            })
            logger.debug("ComplianceMiddleware.modify_request: Created system message with compliance instructions")
        
        return messages
    
    def after_model(
        self,
        state: Dict[str, Any],
        runtime: Any = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Called after LLM response received.
        
        Use cases:
        - Validate outputs
        - Check compliance
        - Log decisions
        - Escalate issues
        
        Args:
            state: Current agent state (contains messages with response)
            runtime: Runtime context
            
        Returns:
            Modified state dict or None (if no changes needed)
        """
        # Extract response content from state
        # In LangGraph, the response is typically in state["messages"]
        response_content = ""
        messages = state.get("messages", [])
        
        if messages:
            # Get the last message (assistant's response)
            last_msg = messages[-1]
            if isinstance(last_msg, dict):
                response_content = last_msg.get("content", "")
            elif hasattr(last_msg, "content"):
                response_content = getattr(last_msg, "content", "")
        
        if not response_content:
            # No response content found, return None (no changes)
            return None
        
        # Check for compliance violations
        violations = self._check_compliance(response_content)
        
        if violations:
            self.violation_count += len(violations)
            
            if self.log_violations:
                logger.warning(
                    f"ComplianceMiddleware.after_model: Found {len(violations)} compliance violations",
                    extra={"violations": violations}
                )
            
            # If strict mode, modify response in state
            if self.strict_mode:
                modified_content = self._fix_violations(response_content, violations)
                
                # Update the last message in state
                if messages:
                    last_msg = messages[-1]
                    if isinstance(last_msg, dict):
                        last_msg["content"] = modified_content
                    elif hasattr(last_msg, "content"):
                        last_msg.content = modified_content
                
                logger.info("ComplianceMiddleware.after_model: Response modified for compliance")
                
                # Return updated state
                return state
        
        # Return None if no changes needed (AgentMiddleware interface)
        return None
    
    def _check_compliance(self, content: str) -> List[Dict[str, Any]]:
        """
        Check content for compliance violations.
        
        Args:
            content: Response content to check
            
        Returns:
            List of violation dictionaries
        """
        violations = []
        content_lower = content.lower()
        
        # Check prohibited terms
        for pattern in self.PROHIBITED_TERMS:
            matches = re.finditer(pattern, content_lower, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": "prohibited_term",
                    "pattern": pattern,
                    "match": match.group(),
                    "position": match.start(),
                })
        
        # Check fair lending violations
        for pattern in self.FAIR_LENDING_VIOLATIONS:
            matches = re.finditer(pattern, content_lower, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": "fair_lending_violation",
                    "pattern": pattern,
                    "match": match.group(),
                    "position": match.start(),
                })
        
        return violations
    
    def _fix_violations(self, content: str, violations: List[Dict[str, Any]]) -> str:
        """
        Fix compliance violations in content.
        
        Args:
            content: Original content
            violations: List of violations found
            
        Returns:
            Modified content with violations addressed
        """
        modified = content
        
        # Add disclaimer at the end
        disclaimer = "\n\n---\n**Compliance Note**: This response has been reviewed for regulatory compliance. Please consult with qualified professionals for financial, legal, or regulatory advice."
        
        # For now, we'll add a disclaimer rather than modifying specific text
        # In production, you might want more sophisticated text replacement
        if violations:
            modified = modified + disclaimer
        
        return modified
    
    def wrap_tool_call(
        self,
        request: Any,
        handler: Callable[[Any], Any],
    ) -> Any:
        """
        Intercept tool execution for compliance monitoring (synchronous).
        
        This is required by AgentMiddleware interface.
        For now, we just pass through to the handler.
        
        Args:
            request: Tool call request
            handler: Handler function to execute the tool
            
        Returns:
            Tool execution result
        """
        # For compliance middleware, we don't need to intercept tool calls
        # but we must implement this method to satisfy the interface
        return handler(request)
    
    async def awrap_tool_call(
        self,
        request: Any,
        handler: Callable[[Any], Any],
    ) -> Any:
        """
        Intercept tool execution for compliance monitoring (asynchronous).
        
        This is required when using ainvoke() or astream().
        The handler is always async when called from async context.
        
        Args:
            request: Tool call request
            handler: Async handler function to execute the tool
            
        Returns:
            Tool execution result (ToolMessage or Command)
        """
        # For compliance middleware, we don't need to intercept tool calls
        # but we must implement this method to satisfy the interface
        # Handler is always async when called from async context (ainvoke/astream)
        return await handler(request)

