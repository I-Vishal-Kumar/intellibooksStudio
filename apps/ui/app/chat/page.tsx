"use client";

import { useState } from "react";
import { ChatContainer } from "@/components/chat";
import { useWebSocketContext } from "@/lib/websocket";

export default function ChatPage() {
  const { sessionId } = useWebSocketContext();
  const [sharedId, setSharedId] = useState<string | null>(null);

  const handleShare = async () => {
    if (!sessionId) return;

    // TODO: Share chat session via REST API
    // This will use the apiClient from lib/api.ts
    try {
      // const result = await apiClient.post(`/api/v1/chat/sessions/${sessionId}/share`);
      // setSharedId(result.data.sharedId);
      // const shareUrl = `${window.location.origin}/chat/${result.data.sharedId}`;
      // await navigator.clipboard.writeText(shareUrl);
      // alert("Chat link copied to clipboard!");
      console.log("Share functionality - to be implemented with REST API");
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

