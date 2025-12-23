import { FC } from "react";
import { SlidersHorizontal, MoreVertical, Sparkles } from "lucide-react";

interface ChatHeaderProps {
    stats?: { total_chunks: number; status: string } | null;
    isConnected?: boolean;
}

export const ChatHeader: FC<ChatHeaderProps> = ({
    stats,
    isConnected = false,
}) => {
    return (
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="font-semibold text-gray-700">Smart Chat</span>
                </div>
                {stats && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {stats.total_chunks} chunks indexed
                    </span>
                )}
                {/* Connection Status */}
                <div
                    className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                    title={isConnected ? "Connected" : "Disconnected"}
                />
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
