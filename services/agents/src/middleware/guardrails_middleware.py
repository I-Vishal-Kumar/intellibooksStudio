"""
Guardrails Middleware for Deep Agents

Implements safety checks and content filtering using LangChain guardrails.
Validates both inputs (before_model) and outputs (after_model).
"""

from typing import Any, Dict, List, Optional, Callable
import logging
import re


class GuardrailsBlockedException(Exception):
    """Exception raised when guardrails block a request."""
    def __init__(self, message: str, reason: str = "unknown"):
        self.message = message
        self.reason = reason
        super().__init__(self.message)

try:
    from langchain.agents.factory import AgentMiddleware
    from langchain_core.messages import AIMessage, HumanMessage
    AGENT_MIDDLEWARE_AVAILABLE = True
except ImportError:
    try:
        from langchain.agents import AgentMiddleware
        from langchain_core.messages import AIMessage, HumanMessage
        AGENT_MIDDLEWARE_AVAILABLE = True
    except ImportError:
        AGENT_MIDDLEWARE_AVAILABLE = False
        AgentMiddleware = object  # Fallback
        AIMessage = None
        HumanMessage = None

logger = logging.getLogger(__name__)


class GuardrailsMiddleware(AgentMiddleware):
    """
    Middleware that implements safety guardrails for agent inputs and outputs.
    
    Implements:
    - before_model: Validate and filter user input
    - after_model: Validate and filter agent output
    
    Features:
    - PII detection and redaction
    - Prompt injection detection
    - Toxic content filtering
    - Banned keyword blocking
    - Model-based safety evaluation (optional)
    """
    
    def __init__(
        self,
        # PII detection
        detect_pii: bool = True,
        pii_types: Optional[List[str]] = None,
        pii_strategy: str = "redact",  # redact, mask, hash, block
        # Prompt injection detection
        detect_prompt_injection: bool = True,
        # Toxic content filtering
        detect_toxic_content: bool = True,
        # Banned keywords
        banned_keywords: Optional[List[str]] = None,
        # Model-based safety (optional - requires LLM)
        use_model_safety_check: bool = False,
        safety_model: Optional[Any] = None,
        # Configuration
        block_on_violation: bool = True,
        log_violations: bool = True,
    ):
        """
        Initialize guardrails middleware.
        
        Args:
            detect_pii: Enable PII detection
            pii_types: List of PII types to detect (email, credit_card, ip, etc.)
            pii_strategy: How to handle PII (redact, mask, hash, block)
            detect_prompt_injection: Enable prompt injection detection
            detect_toxic_content: Enable toxic content detection
            banned_keywords: List of banned keywords to block
            use_model_safety_check: Use LLM for safety evaluation (slower but more accurate)
            safety_model: Optional LLM model for safety checks
            block_on_violation: Block execution if violation detected
            log_violations: Log all violations
        """
        if AGENT_MIDDLEWARE_AVAILABLE and AgentMiddleware != object:
            super().__init__()
        
        self.detect_pii = detect_pii
        self.pii_types = pii_types or ["email", "credit_card", "ip", "api_key"]
        self.pii_strategy = pii_strategy
        self.detect_prompt_injection = detect_prompt_injection
        self.detect_toxic_content = detect_toxic_content
        self.banned_keywords = banned_keywords or []
        self.use_model_safety_check = use_model_safety_check
        self.safety_model = safety_model
        self.block_on_violation = block_on_violation
        self.log_violations = log_violations
        self.violation_count = 0
        
        # PII detection patterns
        self.pii_patterns = {
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "credit_card": r'\b(?:\d{4}[-\s]?){3}\d{4}\b',  # Basic pattern (Luhn validation would be better)
            "ip": r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
            "api_key": r'\b(sk-[a-zA-Z0-9]{32,}|AIza[0-9A-Za-z-_]{35})\b',  # OpenAI/Google API keys
            "phone": r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
            "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
        }
        
        # Prompt injection patterns
        self.prompt_injection_patterns = [
            r'(ignore|forget|disregard).*(previous|above|instructions)',
            r'(you are|act as|pretend to be)',
            r'(system|assistant).*(prompt|instruction)',
            r'\[INST\]|\[/INST\]',  # Llama format
            r'<\|im_start\|>|<\|im_end\|>',  # ChatML format
        ]
        
        # Toxic content patterns (basic - can be enhanced with ML model)
        self.toxic_patterns = [
            r'\b(fuck|shit|damn|hell|bitch|asshole)\b',
            r'\b(kill|murder|suicide|bomb|explosive)\b',
            r'\b(hack|exploit|malware|virus|trojan)\b',
        ]
    
    def _detect_pii(self, text: str) -> List[Dict[str, Any]]:
        """Detect PII in text."""
        violations = []
        
        for pii_type in self.pii_types:
            if pii_type not in self.pii_patterns:
                continue
            
            pattern = self.pii_patterns[pii_type]
            matches = re.finditer(pattern, text, re.IGNORECASE)
            
            for match in matches:
                violations.append({
                    "type": "pii",
                    "pii_type": pii_type,
                    "match": match.group(),
                    "position": match.start(),
                    "severity": "high" if pii_type in ["credit_card", "ssn", "api_key"] else "medium",
                })
        
        return violations
    
    def _redact_pii(self, text: str, violations: List[Dict[str, Any]]) -> str:
        """Redact PII from text based on strategy."""
        if self.pii_strategy == "block":
            return text  # Don't modify, will block later
        
        result = text
        # Sort by position descending to avoid offset issues
        sorted_violations = sorted(violations, key=lambda x: x["position"], reverse=True)
        
        for violation in sorted_violations:
            match_text = violation["match"]
            pii_type = violation["pii_type"]
            
            if self.pii_strategy == "redact":
                replacement = f"[REDACTED_{pii_type.upper()}]"
            elif self.pii_strategy == "mask":
                if pii_type == "credit_card":
                    # Mask all but last 4 digits
                    replacement = "****-****-****-" + match_text[-4:] if len(match_text) >= 4 else "****"
                elif pii_type == "email":
                    # Mask email domain
                    parts = match_text.split("@")
                    if len(parts) == 2:
                        replacement = parts[0][:2] + "***@" + parts[1][:2] + "***"
                    else:
                        replacement = "***@***"
                else:
                    replacement = "***"
            elif self.pii_strategy == "hash":
                import hashlib
                replacement = hashlib.sha256(match_text.encode()).hexdigest()[:8]
            else:
                replacement = f"[REDACTED_{pii_type.upper()}]"
            
            # Replace in reverse order to maintain positions
            result = result[:violation["position"]] + replacement + result[violation["position"] + len(match_text):]
        
        return result
    
    def _detect_prompt_injection(self, text: str) -> List[Dict[str, Any]]:
        """Detect prompt injection attempts."""
        violations = []
        text_lower = text.lower()
        
        for pattern in self.prompt_injection_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": "prompt_injection",
                    "pattern": pattern,
                    "match": match.group(),
                    "position": match.start(),
                    "severity": "high",
                })
        
        return violations
    
    def _detect_toxic_content(self, text: str) -> List[Dict[str, Any]]:
        """Detect toxic/inappropriate content."""
        violations = []
        text_lower = text.lower()
        
        for pattern in self.toxic_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": "toxic_content",
                    "pattern": pattern,
                    "match": match.group(),
                    "position": match.start(),
                    "severity": "high",
                })
        
        return violations
    
    def _check_banned_keywords(self, text: str) -> List[Dict[str, Any]]:
        """Check for banned keywords."""
        violations = []
        text_lower = text.lower()
        
        for keyword in self.banned_keywords:
            if keyword.lower() in text_lower:
                violations.append({
                    "type": "banned_keyword",
                    "keyword": keyword,
                    "severity": "medium",
                })
        
        return violations
    
    def before_model(
        self,
        state: Dict[str, Any],
        runtime: Any = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Called before LLM invocation.
        Validates and filters user input.
        
        Args:
            state: Current agent state
            runtime: Runtime context
            
        Returns:
            Modified state or None
        """
        if "messages" not in state:
            return None
        
        messages = state.get("messages", [])
        if not messages:
            return None
        
        # Get the last user message (input)
        user_message = None
        user_message_idx = None
        for i, msg in enumerate(reversed(messages)):
            msg_dict = msg if isinstance(msg, dict) else msg.__dict__ if hasattr(msg, "__dict__") else {}
            role = msg_dict.get("role") if isinstance(msg_dict, dict) else getattr(msg, "role", None)
            msg_type = msg_dict.get("type") if isinstance(msg_dict, dict) else getattr(msg, "type", None)
            
            if role == "user" or msg_type == "human" or isinstance(msg, HumanMessage):
                user_message = msg
                user_message_idx = len(messages) - 1 - i
                break
        
        if not user_message:
            return None
        
        # Extract content
        if isinstance(user_message, dict):
            content = user_message.get("content", "")
        elif hasattr(user_message, "content"):
            content = getattr(user_message, "content", "")
        else:
            content = str(user_message)
        
        if not content:
            return None
        
        # Run all guardrails on input
        all_violations = []
        modified_content = content
        
        # 1. PII Detection
        if self.detect_pii:
            pii_violations = self._detect_pii(content)
            all_violations.extend(pii_violations)
            
            if pii_violations:
                if self.pii_strategy == "block":
                    if self.block_on_violation:
                        block_message = "I cannot process requests containing sensitive personal information. Please remove any PII and try again."
                        logger.warning(f"🚫 PII detected in input - blocking request")
                        # Raise exception to stop execution immediately
                        raise GuardrailsBlockedException(block_message, reason="pii_detected")
                else:
                    modified_content = self._redact_pii(modified_content, pii_violations)
                    logger.info(f"🔒 PII redacted from input: {len(pii_violations)} instances")
        
        # 2. Prompt Injection Detection
        if self.detect_prompt_injection:
            injection_violations = self._detect_prompt_injection(content)
            all_violations.extend(injection_violations)
            
            if injection_violations and self.block_on_violation:
                block_message = "I cannot process requests that attempt to override my instructions. Please rephrase your question."
                logger.warning(f"🚫 Prompt injection detected - blocking request")
                # Raise exception to stop execution immediately
                raise GuardrailsBlockedException(block_message, reason="prompt_injection")
        
        # 3. Toxic Content Detection
        if self.detect_toxic_content:
            toxic_violations = self._detect_toxic_content(content)
            all_violations.extend(toxic_violations)
            
            if toxic_violations and self.block_on_violation:
                block_message = "I cannot process requests containing inappropriate or harmful content. Please rephrase your question respectfully."
                logger.warning(f"🚫 Toxic content detected - blocking request")
                # Raise exception to stop execution immediately
                raise GuardrailsBlockedException(block_message, reason="toxic_content")
        
        # 4. Banned Keywords
        if self.banned_keywords:
            keyword_violations = self._check_banned_keywords(content)
            all_violations.extend(keyword_violations)
            
            if keyword_violations and self.block_on_violation:
                block_message = "I cannot process requests containing prohibited content. Please rephrase your question."
                logger.warning(f"🚫 Banned keywords detected - blocking request")
                # Raise exception to stop execution immediately
                raise GuardrailsBlockedException(block_message, reason="banned_keyword")
        
        # Log violations
        if all_violations and self.log_violations:
            self.violation_count += len(all_violations)
            logger.warning(
                f"⚠️  Guardrails: {len(all_violations)} violations detected in input",
                extra={"violations": all_violations}
            )
        
        # Update message content if modified (PII redaction)
        if modified_content != content and user_message_idx is not None:
            if isinstance(messages[user_message_idx], dict):
                messages[user_message_idx]["content"] = modified_content
            elif hasattr(messages[user_message_idx], "content"):
                setattr(messages[user_message_idx], "content", modified_content)
            state["messages"] = messages
        
        return state
    
    def after_model(
        self,
        state: Dict[str, Any],
        runtime: Any = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Called after LLM response received.
        Validates and filters agent output.
        
        Args:
            state: Current agent state (contains messages with response)
            runtime: Runtime context
            
        Returns:
            Modified state or None
        """
        if "messages" not in state:
            return None
        
        messages = state.get("messages", [])
        if not messages:
            return None
        
        # Get the last AI message (output)
        ai_message = None
        ai_message_idx = None
        for i, msg in enumerate(reversed(messages)):
            msg_dict = msg if isinstance(msg, dict) else msg.__dict__ if hasattr(msg, "__dict__") else {}
            role = msg_dict.get("role") if isinstance(msg_dict, dict) else getattr(msg, "role", None)
            msg_type = msg_dict.get("type") if isinstance(msg_dict, dict) else getattr(msg, "type", None)
            
            if role == "assistant" or msg_type == "ai" or isinstance(msg, AIMessage):
                ai_message = msg
                ai_message_idx = len(messages) - 1 - i
                break
        
        if not ai_message:
            return None
        
        # Extract content
        if isinstance(ai_message, dict):
            content = ai_message.get("content", "")
        elif hasattr(ai_message, "content"):
            content = getattr(ai_message, "content", "")
        else:
            content = str(ai_message)
        
        if not content:
            return None
        
        # Run guardrails on output
        all_violations = []
        modified_content = content
        
        # 1. PII Detection (output should not contain PII)
        if self.detect_pii:
            pii_violations = self._detect_pii(content)
            all_violations.extend(pii_violations)
            
            if pii_violations:
                if self.pii_strategy == "block":
                    if self.block_on_violation:
                        logger.warning(f"🚫 PII detected in output - blocking response")
                        modified_content = "I cannot provide responses containing sensitive personal information."
                else:
                    modified_content = self._redact_pii(modified_content, pii_violations)
                    logger.info(f"🔒 PII redacted from output: {len(pii_violations)} instances")
        
        # 2. Toxic Content Detection
        if self.detect_toxic_content:
            toxic_violations = self._detect_toxic_content(content)
            all_violations.extend(toxic_violations)
            
            if toxic_violations:
                logger.warning(f"🚫 Toxic content detected in output")
                if self.block_on_violation:
                    modified_content = "I cannot provide responses containing inappropriate content."
        
        # 3. Model-based safety check (optional, more accurate but slower)
        if self.use_model_safety_check and self.safety_model:
            try:
                safety_prompt = f"""Evaluate if this response is safe and appropriate.
Respond with only 'SAFE' or 'UNSAFE'.

Response: {content[:500]}"""  # Limit to first 500 chars for efficiency
                
                # Use safety model to evaluate
                if hasattr(self.safety_model, "invoke"):
                    result = self.safety_model.invoke([{"role": "user", "content": safety_prompt}])
                elif hasattr(self.safety_model, "ainvoke"):
                    import asyncio
                    result = asyncio.run(self.safety_model.ainvoke([{"role": "user", "content": safety_prompt}]))
                else:
                    result = None
                
                if result:
                    result_content = result.content if hasattr(result, "content") else str(result)
                    if "UNSAFE" in result_content.upper():
                        all_violations.append({
                            "type": "model_safety_check",
                            "severity": "high",
                        })
                        if self.block_on_violation:
                            modified_content = "I cannot provide that response. Please rephrase your request."
                        logger.warning(f"🚫 Model safety check failed - response flagged as unsafe")
            except Exception as e:
                logger.warning(f"Model safety check failed: {e}")
        
        # Log violations
        if all_violations and self.log_violations:
            self.violation_count += len(all_violations)
            logger.warning(
                f"⚠️  Guardrails: {len(all_violations)} violations detected in output",
                extra={"violations": all_violations}
            )
        
        # Update message content if modified
        if modified_content != content and ai_message_idx is not None:
            if isinstance(messages[ai_message_idx], dict):
                messages[ai_message_idx]["content"] = modified_content
            elif hasattr(messages[ai_message_idx], "content"):
                setattr(messages[ai_message_idx], "content", modified_content)
            state["messages"] = messages
        
        return state
    
    def wrap_tool_call(
        self,
        request: Any,
        handler: Callable[[Any], Any],
    ) -> Any:
        """Intercept tool execution (pass-through for now)."""
        return handler(request)
    
    async def awrap_tool_call(
        self,
        request: Any,
        handler: Callable[[Any], Any],
    ) -> Any:
        """Intercept tool execution asynchronously (pass-through for now)."""
        return await handler(request)

