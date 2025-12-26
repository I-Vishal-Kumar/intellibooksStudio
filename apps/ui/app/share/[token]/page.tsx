"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatPanel from "../../components/studio/ChatPanel";
import { Loader2 } from "lucide-react";

interface PublicConversation {
    id: string;
    title: string;
    is_public: boolean;
    messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        created_at: string;
    }>;
}

export default function PublicChatPage() {
    const params = useParams();
    const token = params.token as string;

    const [conversation, setConversation] = useState<PublicConversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) return;

        const fetchChat = async () => {
            try {
                const res = await fetch(`http://localhost:8004/api/conversations/public/${token}`);
                if (!res.ok) {
                    throw new Error("Chat not found or private");
                }
                const data = await res.json();
                setConversation(data);
            } catch (err) {
                setError("Failed to load conversation. It may not exist or is no longer public.");
            } finally {
                setLoading(false);
            }
        };

        fetchChat();
    }, [token]);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (error || !conversation) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Unavailable</h1>
                <p className="text-gray-500">{error}</p>
            </div>
        );
    }

    // Transform messages to match ChatPanel interface
    const formattedMessages = conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        // Public view might not have sources detail, or we can add it later
        sources: []
    }));

    return (
        <div className="h-screen w-full bg-gray-100 p-4 sm:p-8 flex flex-col">
            <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col h-full bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold shrink-0">
                            P
                        </div>
                        <div>
                            <h1 className="font-semibold text-gray-900 line-clamp-1">{conversation.title || "Shared Conversation"}</h1>
                            <p className="text-xs text-gray-500">Public Link View</p>
                        </div>
                    </div>
                </div>

                {/* Chat Panel - Read Only */}
                <ChatPanel
                    hasSources={true} // Always show content
                    messages={formattedMessages}
                    readOnly={true} // Add this prop
                />
            </div>

            <div className="text-center mt-4">
                <p className="text-xs text-gray-400">
                    Powered by Intellibooks Studio
                </p>
            </div>
        </div>
    );
}
