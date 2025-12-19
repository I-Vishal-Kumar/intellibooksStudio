"use client";

import { WebSocketProvider } from "@/lib/websocket";
import { useState } from "react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <WebSocketProvider
      sessionId={sessionId}
      onSessionIdChange={setSessionId}
    >
      {children}
    </WebSocketProvider>
  );
}

