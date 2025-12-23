export type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketMessage {
  type: "message" | "research" | "error" | "system" | "status";
  content?: string;
  role?: "user" | "assistant" | "system";
  session_id?: string;
  message_id?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  code?: string;
  event?: string;
  research_params?: {
    top_k?: number;
    filters?: Record<string, unknown>;
    use_rag?: boolean;
  };
  // Status message fields (from smart handler)
  status?: string;
  intent?: string;
  description?: string;
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

