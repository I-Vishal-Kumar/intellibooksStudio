"""
Agent Factory Service

Creates dynamic agents on demand based on user prompts.
Agents are created with specific capabilities, tools, and behaviors.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Agent Factory",
    description="Dynamic agent creation and management",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# External service URLs
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:8005")
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8001")


class TrustLevel(str, Enum):
    UNTRUSTED = "untrusted"
    BASIC = "basic"
    VERIFIED = "verified"
    TRUSTED = "trusted"
    PRIVILEGED = "privileged"


class AgentCapability(str, Enum):
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    COMMUNICATE = "communicate"
    ANALYZE = "analyze"
    GENERATE = "generate"


class Skill(BaseModel):
    name: str
    description: str
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    input_types: List[str] = []
    output_types: List[str] = []


class AgentIdentity(BaseModel):
    agent_id: str
    name: str
    description: str
    version: str = "1.0.0"
    trust_level: TrustLevel = TrustLevel.BASIC
    skills: List[Skill] = []
    capabilities: List[AgentCapability] = []
    tools: List[str] = []  # MCP tools this agent can use
    created_at: datetime
    created_by: str
    metadata: Dict[str, Any] = {}


class AgentConfig(BaseModel):
    llm_provider: str = "openrouter"  # openai, anthropic, openrouter
    llm_model: str = "anthropic/claude-sonnet-4"
    temperature: float = 0.7
    max_tokens: int = 4096
    system_prompt: Optional[str] = None


class CreateAgentRequest(BaseModel):
    name: str
    description: str
    purpose: str  # What this agent is designed to do
    skills: List[str] = []  # Skill names
    tools: List[str] = []  # MCP tools to enable
    capabilities: List[AgentCapability] = [AgentCapability.READ, AgentCapability.ANALYZE]
    trust_level: TrustLevel = TrustLevel.BASIC
    config: Optional[AgentConfig] = None
    created_by: str = "system"


class ExecuteTaskRequest(BaseModel):
    agent_id: str
    task: str
    context: Dict[str, Any] = {}
    session_id: Optional[str] = None


class AgentExecutionResult(BaseModel):
    agent_id: str
    task: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    tools_used: List[str] = []
    execution_time_ms: float
    trace_id: str


# In-memory agent store (would be Redis/DB in production)
agents: Dict[str, AgentIdentity] = {}
agent_configs: Dict[str, AgentConfig] = {}

# HTTP client
http_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(timeout=60.0)
    return http_client


async def call_mcp_tool(tool: str, arguments: Dict[str, Any]) -> Optional[Any]:
    """Call an MCP tool via the gateway."""
    client = await get_client()

    try:
        response = await client.post(
            f"{MCP_GATEWAY_URL}/api/mcp/call",
            json={
                "tool": tool,
                "arguments": arguments,
            },
        )
        response.raise_for_status()
        result = response.json()

        if result.get("success"):
            return result.get("result")
        return None

    except Exception as e:
        logger.error(f"MCP tool call failed: {e}")
        return None


async def get_available_tools() -> List[Dict[str, Any]]:
    """Get list of all available MCP tools."""
    client = await get_client()

    try:
        response = await client.get(f"{MCP_GATEWAY_URL}/api/mcp/tools")
        response.raise_for_status()
        return response.json().get("tools", [])
    except Exception as e:
        logger.error(f"Failed to get tools: {e}")
        return []


def generate_system_prompt(agent: AgentIdentity, config: AgentConfig) -> str:
    """Generate a system prompt for the agent."""
    if config.system_prompt:
        return config.system_prompt

    skills_text = "\n".join([f"- {s.name}: {s.description}" for s in agent.skills])
    tools_text = "\n".join([f"- {t}" for t in agent.tools])

    return f"""You are {agent.name}, an AI agent with the following identity:

Description: {agent.description}

Your Skills:
{skills_text}

Available Tools (via MCP):
{tools_text}

Your Trust Level: {agent.trust_level.value}
Your Capabilities: {', '.join([c.value for c in agent.capabilities])}

Instructions:
1. Use your skills and tools to accomplish tasks
2. Always explain your reasoning
3. When you need information, use the appropriate MCP tools
4. Respect your trust level - don't attempt actions beyond your authorization
5. Provide clear, structured responses

Remember: You were created to help with specific tasks. Focus on your strengths and use your tools effectively.
"""


# API Endpoints
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agent-factory",
        "timestamp": datetime.utcnow().isoformat(),
        "agents_count": len(agents),
    }


@app.post("/api/agents/create", response_model=AgentIdentity)
async def create_agent(request: CreateAgentRequest):
    """Create a new dynamic agent."""
    agent_id = str(uuid4())

    # Build skills from names
    skills = []
    for skill_name in request.skills:
        skills.append(Skill(
            name=skill_name,
            description=f"Skill for {skill_name}",
            confidence=0.8,
        ))

    # Validate tools exist
    available_tools = await get_available_tools()
    available_tool_names = [t.get("name") for t in available_tools]

    valid_tools = [t for t in request.tools if t in available_tool_names]
    if len(valid_tools) < len(request.tools):
        invalid = set(request.tools) - set(valid_tools)
        logger.warning(f"Some tools not available: {invalid}")

    # Create agent identity
    agent = AgentIdentity(
        agent_id=agent_id,
        name=request.name,
        description=request.description,
        trust_level=request.trust_level,
        skills=skills,
        capabilities=request.capabilities,
        tools=valid_tools,
        created_at=datetime.utcnow(),
        created_by=request.created_by,
        metadata={
            "purpose": request.purpose,
        },
    )

    # Store agent config
    config = request.config or AgentConfig()

    agents[agent_id] = agent
    agent_configs[agent_id] = config

    logger.info(f"Created agent: {agent.name} ({agent_id}) with {len(valid_tools)} tools")

    return agent


@app.get("/api/agents", response_model=List[AgentIdentity])
async def list_agents():
    """List all created agents."""
    return list(agents.values())


@app.get("/api/agents/{agent_id}", response_model=AgentIdentity)
async def get_agent(agent_id: str):
    """Get a specific agent by ID."""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agents[agent_id]


@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent."""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")

    del agents[agent_id]
    if agent_id in agent_configs:
        del agent_configs[agent_id]

    return {"success": True, "message": f"Agent {agent_id} deleted"}


@app.post("/api/agents/execute", response_model=AgentExecutionResult)
async def execute_task(request: ExecuteTaskRequest):
    """Execute a task with a specific agent."""
    trace_id = str(uuid4())
    start_time = datetime.utcnow()

    if request.agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agents[request.agent_id]
    config = agent_configs.get(request.agent_id, AgentConfig())

    tools_used = []

    try:
        # Generate system prompt
        system_prompt = generate_system_prompt(agent, config)

        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.task},
        ]

        # Add context if provided
        if request.context:
            context_str = json.dumps(request.context, indent=2)
            messages.insert(1, {
                "role": "system",
                "content": f"Context for this task:\n{context_str}",
            })

        # Call LLM (via OpenRouter or direct provider)
        client = await get_client()

        if config.llm_provider == "openrouter":
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.llm_model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                },
            )
            response.raise_for_status()
            llm_result = response.json()
            result_content = llm_result["choices"][0]["message"]["content"]

        elif config.llm_provider == "openai":
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.llm_model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                },
            )
            response.raise_for_status()
            llm_result = response.json()
            result_content = llm_result["choices"][0]["message"]["content"]

        elif config.llm_provider == "anthropic":
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": os.getenv("ANTHROPIC_API_KEY"),
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.llm_model,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": request.task}],
                    "max_tokens": config.max_tokens,
                },
            )
            response.raise_for_status()
            llm_result = response.json()
            result_content = llm_result["content"][0]["text"]

        else:
            raise ValueError(f"Unknown LLM provider: {config.llm_provider}")

        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return AgentExecutionResult(
            agent_id=request.agent_id,
            task=request.task,
            success=True,
            result=result_content,
            tools_used=tools_used,
            execution_time_ms=execution_time,
            trace_id=trace_id,
        )

    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        return AgentExecutionResult(
            agent_id=request.agent_id,
            task=request.task,
            success=False,
            error=str(e),
            tools_used=tools_used,
            execution_time_ms=execution_time,
            trace_id=trace_id,
        )


@app.post("/api/agents/from-prompt")
async def create_agent_from_prompt(prompt: str, created_by: str = "user"):
    """
    Create an agent automatically from a natural language prompt.
    Uses LLM to determine agent configuration.
    """
    client = await get_client()

    # Get available tools
    available_tools = await get_available_tools()
    tools_list = "\n".join([f"- {t.get('name')}: {t.get('description', '')}" for t in available_tools])

    # Use LLM to determine agent config
    system_prompt = f"""You are an agent configuration expert. Based on the user's request,
determine the best configuration for a new AI agent.

Available MCP Tools:
{tools_list}

Available Capabilities: read, write, execute, communicate, analyze, generate

Trust Levels: untrusted, basic, verified, trusted, privileged

Respond with a JSON object containing:
{{
    "name": "agent name",
    "description": "what this agent does",
    "purpose": "specific purpose",
    "skills": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "capabilities": ["read", "analyze"],
    "trust_level": "basic"
}}

Only include tools from the available list. Be specific and practical.
"""

    try:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json",
            },
            json={
                "model": "anthropic/claude-sonnet-4",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 1000,
            },
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        # Parse JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            config = json.loads(json_match.group())

            # Create the agent
            request = CreateAgentRequest(
                name=config.get("name", "Dynamic Agent"),
                description=config.get("description", "An AI agent"),
                purpose=config.get("purpose", prompt),
                skills=config.get("skills", []),
                tools=config.get("tools", []),
                capabilities=[AgentCapability(c) for c in config.get("capabilities", ["read"])],
                trust_level=TrustLevel(config.get("trust_level", "basic")),
                created_by=created_by,
            )

            return await create_agent(request)

        raise ValueError("Could not parse agent configuration from LLM response")

    except Exception as e:
        logger.error(f"Failed to create agent from prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tools")
async def list_available_tools():
    """List all available MCP tools that agents can use."""
    return {"tools": await get_available_tools()}


# Templates for common agent types
AGENT_TEMPLATES = {
    "email-assistant": {
        "name": "Email Assistant",
        "description": "Helps manage and respond to emails",
        "purpose": "Email management and drafting",
        "skills": ["email-reading", "email-writing", "summarization"],
        "tools": ["list_messages", "get_message", "send_email", "search_emails"],
        "capabilities": [AgentCapability.READ, AgentCapability.WRITE, AgentCapability.COMMUNICATE],
        "trust_level": TrustLevel.VERIFIED,
    },
    "task-manager": {
        "name": "Task Manager",
        "description": "Manages tasks and work items across platforms",
        "purpose": "Task tracking and management",
        "skills": ["task-organization", "priority-assessment", "deadline-tracking"],
        "tools": ["list_tasks", "create_task", "update_task", "list_work_items"],
        "capabilities": [AgentCapability.READ, AgentCapability.WRITE, AgentCapability.ANALYZE],
        "trust_level": TrustLevel.VERIFIED,
    },
    "research-assistant": {
        "name": "Research Assistant",
        "description": "Helps with research and information gathering",
        "purpose": "Information research and synthesis",
        "skills": ["information-gathering", "summarization", "analysis"],
        "tools": ["search", "search_code", "search_messages", "search_files"],
        "capabilities": [AgentCapability.READ, AgentCapability.ANALYZE],
        "trust_level": TrustLevel.BASIC,
    },
    "meeting-assistant": {
        "name": "Meeting Assistant",
        "description": "Helps manage meetings and follow-ups",
        "purpose": "Meeting management and note-taking",
        "skills": ["meeting-scheduling", "note-taking", "action-item-extraction"],
        "tools": ["list_meetings", "get_meeting", "get_transcript"],
        "capabilities": [AgentCapability.READ, AgentCapability.ANALYZE, AgentCapability.COMMUNICATE],
        "trust_level": TrustLevel.VERIFIED,
    },
}


@app.get("/api/templates")
async def list_templates():
    """List available agent templates."""
    return {"templates": AGENT_TEMPLATES}


@app.post("/api/agents/from-template/{template_name}")
async def create_from_template(template_name: str, created_by: str = "user"):
    """Create an agent from a predefined template."""
    if template_name not in AGENT_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_name}")

    template = AGENT_TEMPLATES[template_name]

    request = CreateAgentRequest(
        name=template["name"],
        description=template["description"],
        purpose=template["purpose"],
        skills=template["skills"],
        tools=template["tools"],
        capabilities=template["capabilities"],
        trust_level=template["trust_level"],
        created_by=created_by,
    )

    return await create_agent(request)


# Startup/shutdown
@app.on_event("startup")
async def startup():
    logger.info("Agent Factory starting up...")


@app.on_event("shutdown")
async def shutdown():
    global http_client
    if http_client:
        await http_client.aclose()
    logger.info("Agent Factory shut down")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8007)))
