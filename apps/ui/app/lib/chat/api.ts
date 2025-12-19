import { Message } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<Message> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversationId,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }

  const data = await response.json();

  return {
    id: data.id || Date.now().toString(),
    role: "assistant",
    content: data.response || data.content || "I apologize, I couldn't process that request.",
    timestamp: new Date(),
    metadata: data.metadata,
  };
}

export async function createChatSession(title: string): Promise<{ id: string; sharedId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error("Failed to create chat session");
  }

  return response.json();
}

export async function getChatSession(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch chat session");
  }

  return response.json();
}

export async function getSharedChat(sharedId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/shared/${sharedId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch shared chat");
  }

  return response.json();
}

export async function shareChatSession(sessionId: string): Promise<{ sharedId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/share`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to share chat session");
  }

  return response.json();
}

