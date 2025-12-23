import { FC, RefObject } from "react";
import { PlusSquare, Copy, ThumbsUp, ThumbsDown, Clock, BookOpen, Brain, Loader2 } from "lucide-react";

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

interface MessageListProps {
    messages: Message[];
    isQuerying: boolean;
    chatMode: "chat" | "research";
    messagesEndRef: RefObject<HTMLDivElement | null>;
}

export const MessageList: FC<MessageListProps> = ({
    messages,
    isQuerying,
    chatMode,
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
                                {message.metadata?.messageType === "research" ? (
                                    <Brain className="w-4 h-4 text-white" />
                                ) : (
                                    <BookOpen className="w-4 h-4 text-white" />
                                )}
                            </div>
                        )}
                        <div className={message.role === "user" ? "" : "flex-1"}>
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

            {/* Loading indicator */}
            {isQuerying && (
                <div className="flex gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                        {chatMode === "research" ? (
                            <Brain className="w-4 h-4 text-white" />
                        ) : (
                            <BookOpen className="w-4 h-4 text-white" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                        <span className="text-sm text-gray-500">
                            {chatMode === "research" ? "Researching..." : "Searching knowledge base..."}
                        </span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

