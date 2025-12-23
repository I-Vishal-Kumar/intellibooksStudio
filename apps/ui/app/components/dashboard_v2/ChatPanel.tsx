import { FC, useState, useRef, useEffect } from "react";
import {
    SlidersHorizontal,
    MoreVertical,
    PlusSquare,
    Copy,
    ThumbsUp,
    ThumbsDown,
    ArrowUpRight,
    Upload,
    Loader2,
    Clock,
    BookOpen,
    Search,
    FileText,
    Sparkles
} from "lucide-react";

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
}

interface RAGStats {
    total_chunks: number;
    status: string;
}

interface ChatPanelProps {
    hasSources: boolean;
    onUploadClick?: () => void;
    isUploading?: boolean;
    messages?: Message[];
    onSendMessage?: (message: string) => void;
    isQuerying?: boolean;
    stats?: RAGStats | null;
}

const ChatPanel: FC<ChatPanelProps> = ({
    hasSources,
    onUploadClick,
    isUploading,
    messages = [],
    onSendMessage,
    isQuerying = false,
    stats
}) => {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || isQuerying || !hasSources) return;
        onSendMessage?.(input.trim());
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const suggestedQueries = [
        { icon: <Search className="w-5 h-5" />, text: "What are the main topics in my documents?" },
        { icon: <BookOpen className="w-5 h-5" />, text: "Summarize the key points" },
        { icon: <FileText className="w-5 h-5" />, text: "Find information about..." },
        { icon: <Sparkles className="w-5 h-5" />, text: "What insights can you provide?" },
    ];

    return (
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">Chat</span>
                    {stats && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {stats.total_chunks} chunks indexed
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <SlidersHorizontal size={18} />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {isUploading ? (
                    // Uploading state
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-pulse">
                        <div className="w-24 h-32 bg-amber-50 rounded-lg border-2 border-amber-200 flex flex-col items-center justify-center shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-200"></div>
                            <div className="w-12 h-16 bg-white rounded flex flex-col p-1 gap-1">
                                <div className="h-1 bg-gray-100 rounded w-full"></div>
                                <div className="h-1 bg-gray-100 rounded w-2/3"></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-semibold text-gray-900">Processing document...</h3>
                            <p className="text-sm text-gray-500 font-medium">Extracting and indexing content</p>
                        </div>
                    </div>
                ) : !hasSources ? (
                    // No sources state - Simple prompt to use sidebar
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                            <Search size={24} className="text-gray-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium text-gray-700">Start a conversation</h3>
                            <p className="text-sm text-gray-400 max-w-sm">
                                Upload documents using the sidebar to begin querying your knowledge base.
                            </p>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    // Has sources but no messages - Show suggested queries
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                            <BookOpen size={32} className="text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to answer your questions</h3>
                        <p className="text-gray-500 mb-6 max-w-md">
                            Your documents are indexed. Ask anything about the content.
                        </p>

                        {/* Suggested Queries */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                            {suggestedQueries.map((query, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setInput(query.text);
                                        inputRef.current?.focus();
                                    }}
                                    className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 border border-gray-200">
                                        {query.icon}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {query.text}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Messages list
                    <div className="p-6 space-y-6">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`${
                                    message.role === "user" ? "flex justify-end" : ""
                                }`}
                            >
                                <div
                                    className={`${
                                        message.role === "user"
                                            ? "bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]"
                                            : "flex gap-4"
                                    }`}
                                >
                                    {message.role === "assistant" && (
                                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <BookOpen className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    <div className={message.role === "user" ? "" : "flex-1"}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {message.content}
                                        </p>

                                        {/* Sources */}
                                        {message.sources && message.sources.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <p className="text-xs font-medium text-gray-500 mb-2">
                                                    Sources ({message.sources.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {message.sources.slice(0, 3).map((source, i) => (
                                                        <div
                                                            key={i}
                                                            className="p-2 bg-gray-50 rounded-lg border border-gray-100"
                                                        >
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
                                                    <span>
                                                        {new Date(message.timestamp).toLocaleTimeString()}
                                                    </span>
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
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                                    <span className="text-sm text-gray-500">
                                        Searching knowledge base...
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white shrink-0 border-t border-gray-100">
                <div className="relative group">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            !hasSources
                                ? "Upload a source to get started"
                                : isUploading
                                    ? "Processing documents..."
                                    : "Ask a question about your documents..."
                        }
                        className="w-full bg-[#f8fafc] border border-gray-200 rounded-2xl py-3 pl-4 pr-32 text-sm outline-none transition-all focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!hasSources || isUploading}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">
                            {stats?.total_chunks || 0} chunks
                        </span>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isQuerying || !hasSources}
                            className="w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors"
                        >
                            {isQuerying ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <ArrowUpRight size={18} />
                            )}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">
                    {!hasSources
                        ? "Upload documents to enable querying"
                        : "Answers are generated based on your uploaded documents"
                    }
                </p>
            </div>
        </div>
    );
};

export default ChatPanel;
