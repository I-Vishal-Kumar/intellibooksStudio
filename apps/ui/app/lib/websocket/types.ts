export type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketMessage {
  type: "message" | "error" | "system";
  content?: string;
  role?: "user" | "assistant" | "system";
  session_id?: string;
  message_id?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  code?: string;
  event?: string;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

