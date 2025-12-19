"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/lib/chat/types";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ChatHeader } from "./ChatHeader";
import { sendMessage } from "@/lib/chat/api";
import { generateChatTitle } from "@/lib/chat/utils";

interface ChatContainerProps {
  initialMessages?: Message[];
  sessionId?: string;
  sharedId?: string;
  isShared?: boolean;
  onShare?: () => void;
}

export function ChatContainer({
  initialMessages = [],
  sessionId,
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

  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [defaultWelcomeMessage]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const title = generateChatTitle(messages);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const assistantMessage = await sendMessage(content, sessionId);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError("Failed to send message. Please try again.");
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader
        title={title}
        onShare={onShare}
        sharedId={sharedId}
        isShared={isShared}
      />
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
        <MessageList messages={messages} isLoading={isLoading} />
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
      {!isShared && (
        <MessageInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Ask me anything about your audio files..."
        />
      )}
    </div>
  );
}

