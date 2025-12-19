"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChatContainer } from "@/components/chat";
import { Message } from "@/lib/chat/types";
import { apiClient } from "@/lib/api";

export default function SharedChatPage() {
  const params = useParams();
  const sharedId = params.shared_id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedChat = async () => {
      if (!sharedId) return;

      setIsLoading(true);
      setError(null);

      try {
        // TODO: Fetch shared chat via REST API using apiClient
        const response = await apiClient.get(`/api/v1/chat/shared/${sharedId}`);
        const chatData = response.data;
        
        // Convert the API response to Message format
        const loadedMessages: Message[] = chatData.messages?.map((msg: {
          id?: string;
          role?: string;
          content?: string;
          timestamp?: string;
          metadata?: unknown;
        }) => ({
          id: msg.id || Date.now().toString(),
          role: (msg.role === "user" || msg.role === "assistant") ? msg.role : "assistant",
          content: msg.content || "",
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          metadata: msg.metadata,
        })) || [];

        setMessages(loadedMessages);
      } catch (err) {
        console.error("Failed to load shared chat:", err);
        setError("Failed to load shared chat. It may have been deleted or the link is invalid.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSharedChat();
  }, [sharedId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ChatContainer
      initialMessages={messages}
      sharedId={sharedId}
      isShared={true}
    />
  );
}

