"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "@/lib/chat/types";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChatHeader } from "./ChatHeader";
import { generateChatTitle } from "@/lib/chat/utils";
import { useWebSocketContext } from "@/lib/websocket";

interface ChatContainerProps {
  initialMessages?: Message[];
  sessionId?: string;
  sharedId?: string;
  isShared?: boolean;
  onShare?: () => void;
}

export function ChatContainer({
  initialMessages = [],
  sessionId: propSessionId,
  sharedId,
  isShared = false,
  onShare,
}: ChatContainerProps) {
  const defaultWelcomeMessage: Message = {
    id: "welcome",
    role: "assistant",
    content: "Hello! I'm your AI audio assistant. Upload an audio file or ask me questions, and I'll help you transcribe, translate, summarize, or analyze it.",
    timestamp: new Date(),
  };

  const {
    messages: wsMessages,
    sendMessage,
    status,
    error: wsError,
    isConnected,
    sessionId: contextSessionId,
    setSessionId,
  } = useWebSocketContext();

  const [localMessages, setLocalMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [defaultWelcomeMessage]
  );
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync session ID from props to context
  useEffect(() => {
    if (propSessionId && propSessionId !== contextSessionId) {
      setSessionId(propSessionId);
    }
  }, [propSessionId, contextSessionId, setSessionId]);

  // Merge WebSocket messages with local messages
  const messages = isConnected && wsMessages.length > 0 
    ? wsMessages 
    : localMessages;

  // Show loading state when WebSocket is connecting
  useEffect(() => {
    setIsLoading(status === "connecting");
  }, [status]);

  // const title = generateChatTitle(messages);

  const handleSend = (content: string) => {
    if (!content.trim() || isLoading || !isConnected) {
      if (!isConnected) {
        console.warn("WebSocket not connected. Cannot send message.");
      }
      return;
    }

    const success = sendMessage(content, propSessionId || contextSessionId || "");
    if (!success) {
      console.error("Failed to send message via WebSocket");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader
        // title={title}
        onShare={onShare}
        sharedId={sharedId}
        isShared={isShared}
      />
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
        <MessageList messages={messages} isLoading={isLoading} />
        {wsError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">
              Connection error: {wsError}
            </p>
          </div>
        )}
        {!isConnected && status !== "connecting" && (
          <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-600">
              Disconnected. Attempting to reconnect...
            </p>
          </div>
        )}
      </div>
      {!isShared && (
        <MessageInput
          onSend={handleSend}
          isLoading={isLoading || !isConnected}
          placeholder={
            isConnected
              ? "Ask me anything about your audio files..."
              : "Connecting..."
          }
          disabled={!isConnected}
        />
      )}
    </div>
  );
}

