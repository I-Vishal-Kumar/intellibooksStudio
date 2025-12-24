import { FC, RefObject, useEffect } from "react";
import { PlusSquare, Copy, ThumbsUp, ThumbsDown, Clock, Loader2, Sparkles, Database, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

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
            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full max-w-fit">
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

                            <div className={`text-sm leading-relaxed ${
                                message.role === "user" 
                                    ? "prose prose-sm max-w-none prose-invert prose-headings:text-white prose-p:text-white prose-p:my-2 prose-a:text-purple-200 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-strong:font-semibold prose-code:text-purple-200 prose-code:bg-purple-900/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-purple-300 prose-blockquote:pl-4 prose-blockquote:italic prose-hr:border-purple-300"
                                    : "prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:my-2 prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-strong:font-semibold prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-hr:border-gray-200"
                            }`}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={{
                                        // Customize code blocks
                                        code: ({ node, inline, className, children, ...props }) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const isUserMessage = message.role === "user";
                                            return !inline ? (
                                                <pre className={`${isUserMessage ? 'bg-gray-800' : 'bg-gray-900'} text-gray-100 rounded-lg p-4 overflow-x-auto my-2`}>
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                </pre>
                                            ) : (
                                                <code className={`${isUserMessage ? 'text-purple-200 bg-purple-900/30' : 'text-purple-600 bg-purple-50'} px-1 py-0.5 rounded text-xs`} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                        // Customize links
                                        a: ({ node, ...props }) => {
                                            const isUserMessage = message.role === "user";
                                            return (
                                                <a
                                                    className={isUserMessage ? "text-purple-200 hover:underline" : "text-purple-600 hover:underline"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    {...props}
                                                />
                                            );
                                        },
                                        // Customize headings
                                        h1: ({ node, ...props }) => {
                                            const isUserMessage = message.role === "user";
                                            return (
                                                <h1 className={`text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-gray-900'} mt-4 mb-2`} {...props} />
                                            );
                                        },
                                        h2: ({ node, ...props }) => {
                                            const isUserMessage = message.role === "user";
                                            return (
                                                <h2 className={`text-base font-semibold ${isUserMessage ? 'text-white' : 'text-gray-900'} mt-3 mb-2`} {...props} />
                                            );
                                        },
                                        h3: ({ node, ...props }) => {
                                            const isUserMessage = message.role === "user";
                                            return (
                                                <h3 className={`text-sm font-semibold ${isUserMessage ? 'text-white' : 'text-gray-900'} mt-2 mb-1`} {...props} />
                                            );
                                        },
                                        // Customize lists
                                        ul: ({ node, ...props }) => (
                                            <ul className="list-disc pl-5 my-2" {...props} />
                                        ),
                                        ol: ({ node, ...props }) => (
                                            <ol className="list-decimal pl-5 my-2" {...props} />
                                        ),
                                        // Customize blockquotes
                                        blockquote: ({ node, ...props }) => {
                                            const isUserMessage = message.role === "user";
                                            return (
                                                <blockquote className={`border-l-4 ${isUserMessage ? 'border-purple-300 text-purple-100' : 'border-gray-300 text-gray-600'} pl-4 italic my-2`} {...props} />
                                            );
                                        },
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                            </div>

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
                                <div className={`w-8 h-8 bg-linear-to-br ${loadingInfo.color} rounded-lg flex items-center justify-center`}>
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
