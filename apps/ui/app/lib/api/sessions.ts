/**
 * API client for session and document persistence.
 * Provides functions to interact with the WebSocket and RAG services.
 */

// API Configuration
const WS_API_URL = process.env.NEXT_PUBLIC_WS_API_URL || "http://localhost:8004";
const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

// Types
export interface Session {
    session_id: string;
    title: string;
    document_count: number;
    message_count: number;
    is_active: boolean;
    connections: number;
    created_at: string | null;
    updated_at: string | null;
    last_message_at: string | null;
    documents?: Document[];
    messages?: Message[];
}

export interface Document {
    document_id: string;
    filename: string;
    file_type: string;
    file_size_bytes?: number;
    chunks_count: number;
    status: "processing" | "ready" | "error";
    created_at: string | null;
}

export interface Message {
    message_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    sources?: Array<{
        id: string;
        content_preview: string;
        score: number;
        metadata: Record<string, unknown>;
    }>;
    intent?: string;
    rag_used?: boolean;
    processing_time_ms?: number;
    created_at: string | null;
}

export interface SessionsResponse {
    sessions: Session[];
    persistence_enabled: boolean;
}

// Session API functions

/**
 * List all sessions
 */
export async function listSessions(): Promise<SessionsResponse> {
    const response = await fetch(`${WS_API_URL}/api/sessions`);
    if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Create a new session (notebook)
 */
export async function createSession(title: string = "New Notebook", sessionId?: string): Promise<Session> {
    const response = await fetch(`${WS_API_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, session_id: sessionId }),
    });
    if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Get session details with messages and documents
 */
export async function getSession(sessionId: string, includeMessages: boolean = true): Promise<Session> {
    const response = await fetch(
        `${WS_API_URL}/api/sessions/${sessionId}?include_messages=${includeMessages}`
    );
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Session not found");
        }
        throw new Error(`Failed to get session: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Update session title
 */
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const response = await fetch(`${WS_API_URL}/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    if (!response.ok) {
        throw new Error(`Failed to update session: ${response.statusText}`);
    }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${WS_API_URL}/api/sessions/${sessionId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
    }
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(
    sessionId: string,
    limit: number = 100,
    offset: number = 0
): Promise<Message[]> {
    const response = await fetch(
        `${WS_API_URL}/api/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
    }
    const data = await response.json();
    return data.messages;
}

// Document API functions

/**
 * List documents, optionally filtered by session
 */
export async function listDocuments(sessionId?: string): Promise<Document[]> {
    const url = sessionId
        ? `${RAG_API_URL}/api/rag/documents?session_id=${sessionId}`
        : `${RAG_API_URL}/api/rag/documents`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to list documents: ${response.statusText}`);
    }
    const data = await response.json();
    return data.documents || [];
}

/**
 * Upload a document to a session
 */
export async function uploadDocument(
    file: File,
    sessionId: string,
    documentId?: string
): Promise<{
    success: boolean;
    document_id: string;
    filename: string;
    chunks_created: number;
    error?: string;
}> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);
    if (documentId) {
        formData.append("document_id", documentId);
    }

    const response = await fetch(`${RAG_API_URL}/api/rag/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to upload document: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${RAG_API_URL}/api/rag/document/${documentId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
    }
}

/**
 * Get document details
 */
export async function getDocument(documentId: string): Promise<Document> {
    const response = await fetch(`${RAG_API_URL}/api/rag/documents/${documentId}`);
    if (!response.ok) {
        throw new Error(`Failed to get document: ${response.statusText}`);
    }
    return response.json();
}

// Helper to generate a session ID
export function generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fetch documents for a session (alias for listDocuments)
 */
export const fetchDocuments = listDocuments;
