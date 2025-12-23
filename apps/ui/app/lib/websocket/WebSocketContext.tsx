"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { WebSocketMessage, WebSocketStatus } from "./types";
import { Message } from "@/lib/chat/types";

interface WebSocketContextValue {
  status: WebSocketStatus;
  error: string | null;
  sendMessage: (content: string, sessionId: string) => boolean;
  sendResearchMessage: (content: string, sessionId: string, researchParams?: { top_k?: number; filters?: Record<string, unknown>; use_rag?: boolean }) => boolean;
  messages: Message[];
  isConnected: boolean;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  sessionId?: string | null;
  onSessionIdChange?: (id: string | null) => void;
}

export function WebSocketProvider({
  children,
  sessionId: initialSessionId,
  onSessionIdChange,
}: WebSocketProviderProps) {
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Get WebSocket URL from environment or use default
  const getWebSocketUrl = useCallback((sessionId: string | null) => {
    if (!sessionId) return null;
    
    const wsPort = 8004; // From ports.json - websocket service port
    const wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost";
    const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
    
    return `${protocol}://${wsHost}:${wsPort}/ws/chat/${sessionId}`;
  }, []);

  const wsUrl = sessionId ? getWebSocketUrl(sessionId) : null;

  const handleMessage = useCallback((wsMessage: WebSocketMessage) => {
    if (!wsMessage.session_id) return;

    // Handle system messages
    if (wsMessage.type === "system") {
      setMessages((prev) => {
        // Check if this system message already exists to prevent duplicates
        const exists = prev.some(
          (msg) =>
            msg.metadata?.system &&
            msg.metadata?.event === wsMessage.event &&
            msg.content === (wsMessage.content || wsMessage.event)
        );
        if (exists) return prev;

        const systemMessage: Message = {
          id: `system-${Date.now()}-${Math.random()}`,
          role: "assistant",
          content: wsMessage.content || wsMessage.event || "System notification",
          timestamp: wsMessage.timestamp ? new Date(wsMessage.timestamp) : new Date(),
          metadata: { system: true, event: wsMessage.event },
        };
        return [...prev, systemMessage];
      });
      return;
    }

    // Handle error messages
    if (wsMessage.type === "error") {
      setMessages((prev) => {
        const errorMessage: Message = {
          id: `error-${Date.now()}-${Math.random()}`,
          role: "assistant",
          content: wsMessage.error || "An error occurred",
          timestamp: new Date(),
          metadata: { error: true, code: wsMessage.code },
        };
        return [...prev, errorMessage];
      });
      return;
    }

    // Handle regular chat messages and research messages
    if ((wsMessage.type === "message" || wsMessage.type === "research") && wsMessage.content) {
      setMessages((prev) => {
        // Check if message already exists to prevent duplicates
        const messageId = wsMessage.message_id || `msg-${Date.now()}`;
        const exists = prev.some((msg) => msg.id === messageId);
        if (exists) return prev;

        const message: Message = {
          id: messageId,
          role: (wsMessage.role === "user" || wsMessage.role === "assistant" || wsMessage.role === "system") 
            ? wsMessage.role 
            : "assistant",
          content: wsMessage.content || "",
          timestamp: wsMessage.timestamp ? new Date(wsMessage.timestamp) : new Date(),
          metadata: {
            ...wsMessage.metadata,
            messageType: wsMessage.type, // Track if it's a research or regular message
          },
        };
        return [...prev, message];
      });
    }
  }, []);

  const { status, error, sendMessage: wsSendMessage } = useWebSocket({
    url: wsUrl || "",
    onMessage: handleMessage,
    onConnect: () => {
      console.log("WebSocket connected to session:", sessionId);
    },
    onDisconnect: () => {
      console.log("WebSocket disconnected from session:", sessionId);
    },
    onError: (err) => {
      console.error("WebSocket error:", err);
    },
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  });

  const sendMessage = useCallback(
    (content: string, targetSessionId?: string) => {
      const targetId = targetSessionId || sessionId;
      if (!targetId) {
        console.error("No session ID available");
        return false;
      }

      // Check if message was already sent (prevent duplicates)
      const messageId = `user-${Date.now()}-${Math.random()}`;
      const userMessage: Message = {
        id: messageId,
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Add user message to local state immediately
      setMessages((prev) => {
        // Prevent duplicate messages
        const exists = prev.some((msg) => msg.id === messageId || (msg.content === content && msg.role === "user" && Date.now() - msg.timestamp.getTime() < 1000));
        if (exists) return prev;
        return [...prev, userMessage];
      });

      // Send via WebSocket
      const success = wsSendMessage({
        type: "message",
        content,
        session_id: targetId,
      });

      return success;
    },
    [sessionId, wsSendMessage]
  );

  const sendResearchMessage = useCallback(
    (content: string, targetSessionId?: string, researchParams?: { top_k?: number; filters?: Record<string, unknown>; use_rag?: boolean }) => {
      const targetId = targetSessionId || sessionId;
      if (!targetId) {
        console.error("No session ID available");
        return false;
      }

      // Check if message was already sent (prevent duplicates)
      const messageId = `research-${Date.now()}-${Math.random()}`;
      const userMessage: Message = {
        id: messageId,
        role: "user",
        content,
        timestamp: new Date(),
        metadata: { messageType: "research" },
      };

      // Add user message to local state immediately
      setMessages((prev) => {
        // Prevent duplicate messages
        const exists = prev.some((msg) => msg.id === messageId || (msg.content === content && msg.role === "user" && Date.now() - msg.timestamp.getTime() < 1000));
        if (exists) return prev;
        return [...prev, userMessage];
      });

      // Send via WebSocket
      const success = wsSendMessage({
        type: "research",
        content,
        session_id: targetId,
        research_params: researchParams,
      });

      return success;
    },
    [sessionId, wsSendMessage]
  );

  const setSessionId = useCallback(
    (id: string | null) => {
      setSessionIdState(id);
      onSessionIdChange?.(id);
      // Clear messages when session changes
      if (id !== sessionId) {
        setMessages([]);
      }
    },
    [sessionId, onSessionIdChange]
  );

  // Initialize session ID if not provided
  useEffect(() => {
    if (!sessionId && !initialSessionId) {
      // Generate a new session ID
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setTimeout(() => {
        setSessionId(newSessionId);
      }, 0);
    }
  }, [sessionId, initialSessionId, setSessionId]);

  const value: WebSocketContextValue = {
    status,
    error,
    sendMessage,
    sendResearchMessage,
    messages,
    isConnected: status === "connected",
    sessionId,
    setSessionId,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
}

