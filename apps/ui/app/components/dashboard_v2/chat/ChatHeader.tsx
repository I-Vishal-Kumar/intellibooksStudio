import { FC } from "react";
import { SlidersHorizontal, MoreVertical, MessageSquare, Brain } from "lucide-react";

interface ChatHeaderProps {
    stats?: { total_chunks: number; status: string } | null;
    chatMode: "chat" | "research";
    onModeChange: (mode: "chat" | "research") => void;
    isConnected?: boolean;
    showModeToggle?: boolean;
}

export const ChatHeader: FC<ChatHeaderProps> = ({
    stats,
    chatMode,
    onModeChange,
    isConnected = false,
    showModeToggle = false,
}) => {
    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-700">Chat</span>
                {stats && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {stats.total_chunks} chunks indexed
                    </span>
                )}
                {/* Mode Toggle */}
                {showModeToggle && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => onModeChange("chat")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                chatMode === "chat"
                                    ? "bg-white text-purple-600 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <MessageSquare className="w-3 h-3 inline mr-1" />
                            Chat
                        </button>
                        <button
                            onClick={() => onModeChange("research")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                chatMode === "research"
                                    ? "bg-white text-purple-600 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <Brain className="w-3 h-3 inline mr-1" />
                            Research
                        </button>
                    </div>
                )}
                {/* Connection Status */}
                {showModeToggle && (
                    <div
                        className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                        title={isConnected ? "Connected" : "Disconnected"}
                    />
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
    );
};

