"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebSocketProvider } from "./lib/websocket";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    // Create QueryClient inside component to avoid sharing between requests
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 1000 * 60 * 5, // 5 minutes
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <WebSocketProvider>{children}</WebSocketProvider>
        </QueryClientProvider>
    );
}

