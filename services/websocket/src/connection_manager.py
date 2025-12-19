"""WebSocket connection manager."""

from typing import Dict, Set
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per session."""

    def __init__(self):
        # session_id -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> session_id mapping
        self.connection_sessions: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        """Connect a WebSocket to a session."""
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        
        self.active_connections[session_id].add(websocket)
        self.connection_sessions[websocket] = session_id
        
        logger.info(f"Client connected to session {session_id}. Total connections: {len(self.active_connections[session_id])}")

    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket from its session."""
        if websocket not in self.connection_sessions:
            return
        
        session_id = self.connection_sessions[websocket]
        
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            
            # Remove session if no connections left
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        
        del self.connection_sessions[websocket]
        
        logger.info(f"Client disconnected from session {session_id}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast_to_session(self, message: dict, session_id: str, exclude: WebSocket = None):
        """Broadcast a message to all connections in a session."""
        if session_id not in self.active_connections:
            logger.warning(f"Attempted to broadcast to non-existent session: {session_id}")
            return
        
        disconnected = set()
        for connection in self.active_connections[session_id]:
            if connection == exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

    def get_session_connections_count(self, session_id: str) -> int:
        """Get the number of active connections for a session."""
        return len(self.active_connections.get(session_id, set()))

    def get_all_sessions(self) -> list[str]:
        """Get all active session IDs."""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()

