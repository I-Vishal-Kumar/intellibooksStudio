"""Simple Chat Agent - Lightweight agent for WebSocket chat without complex dependencies."""

from typing import Optional, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _find_env_file() -> str:
    """Find .env file from project root."""
    # Go up from handlers -> src -> websocket -> services -> project root
    root_env = Path(__file__).parent.parent.parent.parent.parent / ".env"
    if root_env.exists():
        return str(root_env)
    return ".env"


def _load_env_vars() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_vars = {}
    env_file = _find_env_file()

    try:
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except FileNotFoundError:
        logger.warning(f"Env file not found: {env_file}")

    return env_vars


class AgentResult(BaseModel):
    """Result from agent execution."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SimpleChatAgent:
    """Simple chat agent that works like the original implementation."""

    def __init__(self):
        self.name = "simple-chat-agent"
        self.logger = logging.getLogger(f"agent.{self.name}")
        self._llm = None
        self._is_initialized = False

        # System prompt for the chat agent
        self.system_prompt = """You are an intelligent AI assistant for the Audio Insight Platform.
Your role is to provide helpful support and assistance to users.

Guidelines:
- Be concise and clear in your responses (keep responses short, typically 1-3 sentences)
- Focus on being helpful and informative
- You can help users with:
  * Audio transcription and processing
  * Translation services
  * Summarization and analysis
  * Intent detection and keyword extraction
  * General questions about the platform
- If you don't know something, admit it and suggest alternatives
- Maintain a friendly and professional tone
- Avoid overly long explanations unless specifically requested"""

    @property
    def agent_id(self) -> str:
        return "simple-chat-agent-v1"

    @property
    def llm(self):
        """Lazy load LLM."""
        if self._llm is None:
            env_vars = _load_env_vars()

            api_key = env_vars.get('OPENROUTER_API_KEY', '')
            model = env_vars.get('OPENROUTER_MODEL', 'anthropic/claude-sonnet-4')

            if not api_key:
                raise ValueError("OPENROUTER_API_KEY not found in .env file")

            self._llm = ChatOpenAI(
                model=model,
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.7,
                default_headers={
                    "HTTP-Referer": "http://localhost:8004",
                    "X-Title": "Audio Insight Chat",
                },
            )
            self.logger.info(f"LLM initialized with model: {model}")

        return self._llm

    async def initialize(self) -> None:
        """Initialize the agent."""
        self._is_initialized = True
        self.logger.info("SimpleChatAgent initialized")

    async def execute(self, input_data: Dict[str, Any]) -> AgentResult:
        """Execute chat and return response."""
        try:
            message = input_data.get("message") or input_data.get("text", "")

            if not message:
                return AgentResult(
                    success=False,
                    error="No message provided",
                    metadata={"agent_id": self.agent_id}
                )

            # Create prompt
            prompt = ChatPromptTemplate.from_messages([
                ("system", self.system_prompt),
                ("human", "{message}"),
            ])

            # Create chain and invoke
            chain = prompt | self.llm | StrOutputParser()
            response = await chain.ainvoke({"message": message})

            return AgentResult(
                success=True,
                data={
                    "response": response.strip(),
                    "message": message,
                },
                metadata={
                    "agent_id": self.agent_id,
                    "input_length": len(message),
                    "response_length": len(response),
                }
            )

        except Exception as e:
            self.logger.exception("Chat execution failed")
            return AgentResult(
                success=False,
                error=str(e),
                metadata={"agent_id": self.agent_id}
            )

    async def safe_execute(self, input_data: Dict[str, Any]) -> AgentResult:
        """Execute with initialization check."""
        if not self._is_initialized:
            await self.initialize()
        return await self.execute(input_data)
