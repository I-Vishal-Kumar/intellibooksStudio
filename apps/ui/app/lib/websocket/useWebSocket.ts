"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketStatus, WebSocketMessage, WebSocketConfig } from "./types";

export function useWebSocket(config: WebSocketConfig) {
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualCloseRef = useRef(false);

  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  } = config;

  // Store callbacks in refs to avoid recreating connect function
  const callbacksRef = useRef({
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onError,
      onConnect,
      onDisconnect,
    };
  }, [onMessage, onError, onConnect, onDisconnect]);

  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!url) {
      return;
    }

    try {
      setStatus("connecting");
      setError(null);
      isManualCloseRef.current = false;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
        callbacksRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          callbacksRef.current.onMessage?.(message);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          setError("Failed to parse message");
        }
      };

      ws.onerror = (event) => {
        setStatus("error");
        setError("WebSocket connection error");
        callbacksRef.current.onError?.(event);
      };

      ws.onclose = () => {
        setStatus("disconnected");
        callbacksRef.current.onDisconnect?.();

        // Attempt to reconnect if not manually closed
        if (!isManualCloseRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError("Max reconnection attempts reached");
        }
      };
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  // Store connect function in ref for reconnection (use effect to avoid render-time ref update)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      setError("WebSocket is not connected");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!url) {
      // Don't set status here - it's already disconnected by default
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    return () => {
      isManualCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, connect]);

  return {
    status,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect,
  };
}

