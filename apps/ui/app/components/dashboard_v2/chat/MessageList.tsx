import { FC, RefObject } from "react";
import { PlusSquare, Copy, ThumbsUp, ThumbsDown, Clock, Loader2, Sparkles, Database, MessageCircle } from "lucide-react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    sources?: Array<{
        id: string;
        content_preview: string;
        score: number;
        metadata: Record<string, unknown>;
    }>;
    metadata?: Record<string, unknown>;
}

// Processing status from smart handler
interface ProcessingStatus {
    intent: "general_chat" | "knowledge_query" | "hybrid";
    description: string;
}

interface MessageListProps {
    messages: Message[];
    isQuerying: boolean;
    processingStatus?: ProcessingStatus | null;
    messagesEndRef: RefObject<HTMLDivElement | null>;
}

// Get icon and color based on intent/message type
const getMessageIcon = (metadata?: Record<string, unknown>) => {
    const intent = metadata?.detected_intent as string;
    const ragUsed = metadata?.rag_used as boolean;

    if (ragUsed || intent === "knowledge_query") {
        return <Database className="w-4 h-4 text-white" />;
    } else if (intent === "hybrid") {
        return <Sparkles className="w-4 h-4 text-white" />;
    } else {
        return <MessageCircle className="w-4 h-4 text-white" />;
    }
};

// Get loading icon and text based on processing status
const getLoadingInfo = (processingStatus?: ProcessingStatus | null) => {
    if (!processingStatus) {
        return {
            icon: <Sparkles className="w-4 h-4 text-white" />,
            text: "Thinking...",
            color: "from-purple-500 to-purple-600",
        };
    }

    switch (processingStatus.intent) {
        case "knowledge_query":
            return {
                icon: <Database className="w-4 h-4 text-white" />,
                text: processingStatus.description || "Searching knowledge base...",
                color: "from-blue-500 to-blue-600",
            };
        case "hybrid":
            return {
                icon: <Sparkles className="w-4 h-4 text-white" />,
                text: processingStatus.description || "Analyzing query and searching knowledge...",
                color: "from-purple-500 to-pink-500",
            };
        case "general_chat":
        default:
            return {
                icon: <MessageCircle className="w-4 h-4 text-white" />,
                text: processingStatus.description || "Thinking...",
                color: "from-purple-500 to-purple-600",
            };
    }
};

// Badge component for showing what action was taken
const ActionBadge: FC<{ metadata?: Record<string, unknown> }> = ({ metadata }) => {
    const intent = metadata?.detected_intent as string;
    const ragUsed = metadata?.rag_used as boolean;
    const sourcesCount = metadata?.sources_count as number;

    if (!intent && !ragUsed) return null;

    if (ragUsed || intent === "knowledge_query") {
        return (
            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <Database className="w-3 h-3" />
                <span>Knowledge{sourcesCount ? ` (${sourcesCount} sources)` : ""}</span>
            </div>
        );
    } else if (intent === "hybrid") {
        return (
            <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                <span>Smart</span>
            </div>
        );
    }

    return null;
};

export const MessageList: FC<MessageListProps> = ({
    messages,
    isQuerying,
    processingStatus,
    messagesEndRef,
}) => {
    return (
        <div className="p-6 space-y-6">
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`${message.role === "user" ? "flex justify-end" : ""}`}
                >
                    <div
                        className={`${
                            message.role === "user"
                                ? "bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]"
                                : "flex gap-4"
                        }`}
                    >
                        {message.role === "assistant" && (
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                {getMessageIcon(message.metadata)}
                            </div>
                        )}
                        <div className={message.role === "user" ? "" : "flex-1"}>
                            {/* Action badge for assistant messages */}
                            {message.role === "assistant" && (
                                <div className="mb-2">
                                    <ActionBadge metadata={message.metadata} />
                                </div>
                            )}

                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {message.content}
                            </p>

                            {/* Sources */}
                            {message.sources && Array.isArray(message.sources) && message.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 mb-2">
                                        Sources ({message.sources.length})
                                    </p>
                                    <div className="space-y-2">
                                        {message.sources.slice(0, 3).map((source, i) => (
                                            <div key={i} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                    {source.content_preview}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Relevance: {(source.score * 100).toFixed(0)}%
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action buttons for assistant messages */}
                            {message.role === "assistant" && (
                                <div className="flex items-center gap-4 pt-3 mt-3 border-t border-gray-100">
                                    <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm bg-white">
                                        <PlusSquare size={14} />
                                        Save to note
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                        <Copy size={14} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                        <ThumbsUp size={14} />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                        <ThumbsDown size={14} />
                                    </button>
                                    <div className="flex items-center gap-1 ml-auto text-xs text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* Smart Loading indicator */}
            {isQuerying && (
                <div className="flex gap-4">
                    {(() => {
                        const loadingInfo = getLoadingInfo(processingStatus);
                        return (
                            <>
                                <div className={`w-8 h-8 bg-gradient-to-br ${loadingInfo.color} rounded-lg flex items-center justify-center shrink-0`}>
                                    {loadingInfo.icon}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                                    <span className="text-sm text-gray-500">{loadingInfo.text}</span>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};
