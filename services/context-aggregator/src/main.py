"""
Context Aggregator Service

Pulls last 24 hours of context from all connected MCP services.
Provides a unified view of emails, chats, documents, tasks, and meetings.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Context Aggregator",
    description="Aggregates context from all connected services",
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

# MCP Gateway URL
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:8005")


# Models
class Email(BaseModel):
    id: str
    source: str  # gmail, zoho
    subject: str
    sender: str
    recipients: List[str] = []
    snippet: str = ""
    timestamp: datetime
    is_read: bool = False
    has_attachments: bool = False
    labels: List[str] = []


class ChatMessage(BaseModel):
    id: str
    source: str  # slack, teams, zoho-cliq
    channel: str
    sender: str
    content: str
    timestamp: datetime
    thread_id: Optional[str] = None
    reactions: List[str] = []


class Document(BaseModel):
    id: str
    source: str  # drive, erp
    name: str
    type: str
    modified_by: str
    modified_at: datetime
    url: Optional[str] = None
    size_bytes: int = 0


class Task(BaseModel):
    id: str
    source: str  # clickup, azure-devops
    title: str
    status: str
    priority: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    project: Optional[str] = None
    sprint: Optional[str] = None
    updated_at: datetime


class Meeting(BaseModel):
    id: str
    source: str  # zoom, teams
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: int = 0
    participants: List[str] = []
    has_recording: bool = False
    has_transcript: bool = False
    summary: Optional[str] = None


class DailyContext(BaseModel):
    user_id: str
    generated_at: datetime
    period_start: datetime
    period_end: datetime
    emails: List[Email] = []
    chats: List[ChatMessage] = []
    documents: List[Document] = []
    tasks: List[Task] = []
    meetings: List[Meeting] = []
    summary: Optional[str] = None
    errors: Dict[str, str] = {}


class ContextRequest(BaseModel):
    user_id: str
    hours: int = Field(default=24, ge=1, le=168)  # 1 hour to 1 week
    include_emails: bool = True
    include_chats: bool = True
    include_documents: bool = True
    include_tasks: bool = True
    include_meetings: bool = True


# HTTP client for MCP Gateway
http_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(timeout=30.0)
    return http_client


async def call_mcp_tool(
    server: str,
    tool: str,
    arguments: Dict[str, Any],
) -> Optional[Any]:
    """Call an MCP tool via the gateway."""
    client = await get_client()

    try:
        response = await client.post(
            f"{MCP_GATEWAY_URL}/api/mcp/call",
            json={
                "server": server,
                "tool": tool,
                "arguments": arguments,
            },
        )
        response.raise_for_status()
        result = response.json()

        if result.get("success"):
            return result.get("result")
        else:
            logger.warning(f"MCP call failed: {result.get('error')}")
            return None

    except Exception as e:
        logger.error(f"Error calling {server}/{tool}: {e}")
        return None


async def get_emails(user_id: str, since: datetime) -> tuple[List[Email], Optional[str]]:
    """Fetch emails from Gmail and Zoho Mail."""
    emails = []
    error = None

    # Gmail
    try:
        gmail_result = await call_mcp_tool(
            "gmail-mcp",
            "list_messages",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 50,
            },
        )
        if gmail_result:
            for msg in gmail_result:
                emails.append(Email(
                    id=msg.get("id", str(uuid4())),
                    source="gmail",
                    subject=msg.get("subject", "No Subject"),
                    sender=msg.get("from", "Unknown"),
                    recipients=msg.get("to", []),
                    snippet=msg.get("snippet", ""),
                    timestamp=datetime.fromisoformat(msg.get("date", datetime.utcnow().isoformat())),
                    is_read=msg.get("is_read", False),
                    has_attachments=msg.get("has_attachments", False),
                    labels=msg.get("labels", []),
                ))
    except Exception as e:
        error = f"Gmail: {str(e)}"

    # Zoho Mail
    try:
        zoho_result = await call_mcp_tool(
            "zoho-mail-mcp",
            "list_messages",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 50,
            },
        )
        if zoho_result:
            for msg in zoho_result:
                emails.append(Email(
                    id=msg.get("id", str(uuid4())),
                    source="zoho",
                    subject=msg.get("subject", "No Subject"),
                    sender=msg.get("from", "Unknown"),
                    recipients=msg.get("to", []),
                    snippet=msg.get("snippet", ""),
                    timestamp=datetime.fromisoformat(msg.get("date", datetime.utcnow().isoformat())),
                    is_read=msg.get("is_read", False),
                    has_attachments=msg.get("has_attachments", False),
                ))
    except Exception as e:
        if error:
            error += f"; Zoho: {str(e)}"
        else:
            error = f"Zoho: {str(e)}"

    # Sort by timestamp
    emails.sort(key=lambda x: x.timestamp, reverse=True)
    return emails, error


async def get_chats(user_id: str, since: datetime) -> tuple[List[ChatMessage], Optional[str]]:
    """Fetch chat messages from Slack, Teams, and Zoho Cliq."""
    chats = []
    error = None

    # Slack
    try:
        slack_result = await call_mcp_tool(
            "slack-mcp",
            "get_channel_history",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 100,
            },
        )
        if slack_result:
            for msg in slack_result:
                chats.append(ChatMessage(
                    id=msg.get("ts", str(uuid4())),
                    source="slack",
                    channel=msg.get("channel", ""),
                    sender=msg.get("user", "Unknown"),
                    content=msg.get("text", ""),
                    timestamp=datetime.fromtimestamp(float(msg.get("ts", 0))),
                    thread_id=msg.get("thread_ts"),
                    reactions=[r.get("name", "") for r in msg.get("reactions", [])],
                ))
    except Exception as e:
        error = f"Slack: {str(e)}"

    # Teams
    try:
        teams_result = await call_mcp_tool(
            "teams-mcp",
            "get_channel_messages",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 100,
            },
        )
        if teams_result:
            for msg in teams_result:
                chats.append(ChatMessage(
                    id=msg.get("id", str(uuid4())),
                    source="teams",
                    channel=msg.get("channel", ""),
                    sender=msg.get("from", {}).get("user", {}).get("displayName", "Unknown"),
                    content=msg.get("body", {}).get("content", ""),
                    timestamp=datetime.fromisoformat(msg.get("createdDateTime", datetime.utcnow().isoformat())),
                ))
    except Exception as e:
        if error:
            error += f"; Teams: {str(e)}"
        else:
            error = f"Teams: {str(e)}"

    # Zoho Cliq
    try:
        cliq_result = await call_mcp_tool(
            "zoho-cliq-mcp",
            "get_messages",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 100,
            },
        )
        if cliq_result:
            for msg in cliq_result:
                chats.append(ChatMessage(
                    id=msg.get("id", str(uuid4())),
                    source="zoho-cliq",
                    channel=msg.get("channel", ""),
                    sender=msg.get("sender", "Unknown"),
                    content=msg.get("text", ""),
                    timestamp=datetime.fromisoformat(msg.get("time", datetime.utcnow().isoformat())),
                ))
    except Exception as e:
        if error:
            error += f"; Zoho Cliq: {str(e)}"
        else:
            error = f"Zoho Cliq: {str(e)}"

    chats.sort(key=lambda x: x.timestamp, reverse=True)
    return chats, error


async def get_documents(user_id: str, since: datetime) -> tuple[List[Document], Optional[str]]:
    """Fetch recently modified documents from Drive."""
    documents = []
    error = None

    # Google Drive
    try:
        drive_result = await call_mcp_tool(
            "drive-mcp",
            "list_files",
            {
                "user_id": user_id,
                "modified_after": since.isoformat(),
                "limit": 50,
            },
        )
        if drive_result:
            for doc in drive_result:
                documents.append(Document(
                    id=doc.get("id", str(uuid4())),
                    source="drive",
                    name=doc.get("name", "Untitled"),
                    type=doc.get("mimeType", "unknown"),
                    modified_by=doc.get("lastModifyingUser", {}).get("displayName", "Unknown"),
                    modified_at=datetime.fromisoformat(doc.get("modifiedTime", datetime.utcnow().isoformat())),
                    url=doc.get("webViewLink"),
                    size_bytes=int(doc.get("size", 0)),
                ))
    except Exception as e:
        error = f"Drive: {str(e)}"

    documents.sort(key=lambda x: x.modified_at, reverse=True)
    return documents, error


async def get_tasks(user_id: str, since: datetime) -> tuple[List[Task], Optional[str]]:
    """Fetch tasks from ClickUp and Azure DevOps."""
    tasks = []
    error = None

    # ClickUp
    try:
        clickup_result = await call_mcp_tool(
            "clickup-mcp",
            "list_tasks",
            {
                "user_id": user_id,
                "updated_after": since.isoformat(),
                "limit": 50,
            },
        )
        if clickup_result:
            for task in clickup_result:
                tasks.append(Task(
                    id=task.get("id", str(uuid4())),
                    source="clickup",
                    title=task.get("name", "Untitled"),
                    status=task.get("status", {}).get("status", "unknown"),
                    priority=task.get("priority", {}).get("priority"),
                    assignee=task.get("assignees", [{}])[0].get("username") if task.get("assignees") else None,
                    due_date=datetime.fromisoformat(task["due_date"]) if task.get("due_date") else None,
                    project=task.get("list", {}).get("name"),
                    updated_at=datetime.fromtimestamp(int(task.get("date_updated", 0)) / 1000),
                ))
    except Exception as e:
        error = f"ClickUp: {str(e)}"

    # Azure DevOps
    try:
        azure_result = await call_mcp_tool(
            "azure-devops-mcp",
            "list_work_items",
            {
                "user_id": user_id,
                "updated_after": since.isoformat(),
                "limit": 50,
            },
        )
        if azure_result:
            for item in azure_result:
                tasks.append(Task(
                    id=str(item.get("id", uuid4())),
                    source="azure-devops",
                    title=item.get("fields", {}).get("System.Title", "Untitled"),
                    status=item.get("fields", {}).get("System.State", "unknown"),
                    priority=str(item.get("fields", {}).get("Microsoft.VSTS.Common.Priority", "")),
                    assignee=item.get("fields", {}).get("System.AssignedTo", {}).get("displayName"),
                    sprint=item.get("fields", {}).get("System.IterationPath"),
                    updated_at=datetime.fromisoformat(
                        item.get("fields", {}).get("System.ChangedDate", datetime.utcnow().isoformat())
                    ),
                ))
    except Exception as e:
        if error:
            error += f"; Azure DevOps: {str(e)}"
        else:
            error = f"Azure DevOps: {str(e)}"

    tasks.sort(key=lambda x: x.updated_at, reverse=True)
    return tasks, error


async def get_meetings(user_id: str, since: datetime) -> tuple[List[Meeting], Optional[str]]:
    """Fetch meetings from Zoom."""
    meetings = []
    error = None

    # Zoom
    try:
        zoom_result = await call_mcp_tool(
            "zoom-mcp",
            "list_meetings",
            {
                "user_id": user_id,
                "since": since.isoformat(),
                "limit": 50,
            },
        )
        if zoom_result:
            for mtg in zoom_result:
                meetings.append(Meeting(
                    id=str(mtg.get("id", uuid4())),
                    source="zoom",
                    title=mtg.get("topic", "Untitled Meeting"),
                    start_time=datetime.fromisoformat(mtg.get("start_time", datetime.utcnow().isoformat())),
                    duration_minutes=mtg.get("duration", 0),
                    participants=mtg.get("participants", []),
                    has_recording=mtg.get("has_recording", False),
                    has_transcript=mtg.get("has_transcript", False),
                ))
    except Exception as e:
        error = f"Zoom: {str(e)}"

    meetings.sort(key=lambda x: x.start_time, reverse=True)
    return meetings, error


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "context-aggregator",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/context/daily", response_model=DailyContext)
async def get_daily_context(request: ContextRequest):
    """Get aggregated context for the specified time period."""
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(hours=request.hours)

    errors = {}

    # Fetch all data in parallel
    tasks = []

    if request.include_emails:
        tasks.append(get_emails(request.user_id, period_start))
    else:
        tasks.append(asyncio.coroutine(lambda: ([], None))())

    if request.include_chats:
        tasks.append(get_chats(request.user_id, period_start))
    else:
        tasks.append(asyncio.coroutine(lambda: ([], None))())

    if request.include_documents:
        tasks.append(get_documents(request.user_id, period_start))
    else:
        tasks.append(asyncio.coroutine(lambda: ([], None))())

    if request.include_tasks:
        tasks.append(get_tasks(request.user_id, period_start))
    else:
        tasks.append(asyncio.coroutine(lambda: ([], None))())

    if request.include_meetings:
        tasks.append(get_meetings(request.user_id, period_start))
    else:
        tasks.append(asyncio.coroutine(lambda: ([], None))())

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process results
    emails, chats, documents, task_list, meetings = [], [], [], [], []

    if request.include_emails:
        if isinstance(results[0], Exception):
            errors["emails"] = str(results[0])
        else:
            emails, email_error = results[0]
            if email_error:
                errors["emails"] = email_error

    if request.include_chats:
        if isinstance(results[1], Exception):
            errors["chats"] = str(results[1])
        else:
            chats, chat_error = results[1]
            if chat_error:
                errors["chats"] = chat_error

    if request.include_documents:
        if isinstance(results[2], Exception):
            errors["documents"] = str(results[2])
        else:
            documents, doc_error = results[2]
            if doc_error:
                errors["documents"] = doc_error

    if request.include_tasks:
        if isinstance(results[3], Exception):
            errors["tasks"] = str(results[3])
        else:
            task_list, task_error = results[3]
            if task_error:
                errors["tasks"] = task_error

    if request.include_meetings:
        if isinstance(results[4], Exception):
            errors["meetings"] = str(results[4])
        else:
            meetings, meeting_error = results[4]
            if meeting_error:
                errors["meetings"] = meeting_error

    return DailyContext(
        user_id=request.user_id,
        generated_at=datetime.utcnow(),
        period_start=period_start,
        period_end=period_end,
        emails=emails,
        chats=chats,
        documents=documents,
        tasks=task_list,
        meetings=meetings,
        errors=errors,
    )


@app.get("/api/context/summary")
async def get_context_summary(
    user_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get a quick summary of context without full details."""
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(hours=hours)

    # Get counts only (lightweight)
    emails, _ = await get_emails(user_id, period_start)
    chats, _ = await get_chats(user_id, period_start)
    documents, _ = await get_documents(user_id, period_start)
    tasks, _ = await get_tasks(user_id, period_start)
    meetings, _ = await get_meetings(user_id, period_start)

    # Count unread/urgent items
    unread_emails = len([e for e in emails if not e.is_read])
    high_priority_tasks = len([t for t in tasks if t.priority in ["1", "high", "urgent"]])

    return {
        "user_id": user_id,
        "period_hours": hours,
        "counts": {
            "emails": len(emails),
            "unread_emails": unread_emails,
            "chats": len(chats),
            "documents": len(documents),
            "tasks": len(tasks),
            "high_priority_tasks": high_priority_tasks,
            "meetings": len(meetings),
        },
        "generated_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/context/emails")
async def get_emails_only(
    user_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get only emails for the specified period."""
    since = datetime.utcnow() - timedelta(hours=hours)
    emails, error = await get_emails(user_id, since)
    return {"emails": emails, "error": error}


@app.get("/api/context/chats")
async def get_chats_only(
    user_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get only chat messages for the specified period."""
    since = datetime.utcnow() - timedelta(hours=hours)
    chats, error = await get_chats(user_id, since)
    return {"chats": chats, "error": error}


@app.get("/api/context/tasks")
async def get_tasks_only(
    user_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get only tasks for the specified period."""
    since = datetime.utcnow() - timedelta(hours=hours)
    tasks, error = await get_tasks(user_id, since)
    return {"tasks": tasks, "error": error}


@app.get("/api/context/meetings")
async def get_meetings_only(
    user_id: str,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get only meetings for the specified period."""
    since = datetime.utcnow() - timedelta(hours=hours)
    meetings, error = await get_meetings(user_id, since)
    return {"meetings": meetings, "error": error}


# Startup/shutdown
@app.on_event("startup")
async def startup():
    logger.info("Context Aggregator starting up...")


@app.on_event("shutdown")
async def shutdown():
    global http_client
    if http_client:
        await http_client.aclose()
    logger.info("Context Aggregator shut down")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8006)))
