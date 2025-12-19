"use client";

import { useState, useEffect } from "react";
import { ChatContainer } from "@/components/chat";
import { createChatSession, shareChatSession } from "@/lib/chat/api";

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);

  useEffect(() => {
    // Create a new chat session when component mounts
    const initializeSession = async () => {
      try {
        const session = await createChatSession("New Chat");
        setSessionId(session.id);
        if (session.sharedId) {
          setSharedId(session.sharedId);
        }
      } catch (error) {
        console.error("Failed to create chat session:", error);
      }
    };

    initializeSession();
  }, []);

  const handleShare = async () => {
    if (!sessionId) return;

    try {
      const result = await shareChatSession(sessionId);
      setSharedId(result.sharedId);
      // Copy share link to clipboard
      const shareUrl = `${window.location.origin}/chat/${result.sharedId}`;
      await navigator.clipboard.writeText(shareUrl);
      
      // Optionally show a toast notification
      alert("Chat link copied to clipboard!");
    } catch (error) {
      console.error("Failed to share chat:", error);
      alert("Failed to share chat. Please try again.");
    }
  };

  return (
    <ChatContainer
      sessionId={sessionId || undefined}
      sharedId={sharedId || undefined}
      onShare={handleShare}
    />
  );
}

