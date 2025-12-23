import { FC } from "react";
import { Search, BookOpen, Brain, Sparkles, FileText } from "lucide-react";

interface EmptyStateProps {
    hasSources: boolean;
    isUploading: boolean;
    chatMode: "chat" | "research";
    onQueryClick: (query: string) => void;
}

export const EmptyState: FC<EmptyStateProps> = ({
    hasSources,
    isUploading,
    chatMode,
    onQueryClick,
}) => {
    if (isUploading) {
        return (
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
        );
    }

    if (!hasSources && chatMode === "chat") {
        return (
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
        );
    }

    const suggestedQueries = chatMode === "research" 
        ? [
            { icon: <Brain className="w-5 h-5" />, text: "what things should an agent identity card contain?" },
            { icon: <Search className="w-5 h-5" />, text: "analyze the architecture patterns" },
            { icon: <FileText className="w-5 h-5" />, text: "find best practices" },
            { icon: <Sparkles className="w-5 h-5" />, text: "provide comprehensive analysis" },
        ]
        : [
            { icon: <Search className="w-5 h-5" />, text: "What are the main topics in my documents?" },
            { icon: <BookOpen className="w-5 h-5" />, text: "Summarize the key points" },
            { icon: <FileText className="w-5 h-5" />, text: "Find information about..." },
            { icon: <Sparkles className="w-5 h-5" />, text: "What insights can you provide?" },
        ];

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                {chatMode === "research" ? (
                    <Brain size={32} className="text-white" />
                ) : (
                    <BookOpen size={32} className="text-white" />
                )}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {chatMode === "research" ? "Ready for research" : "Ready to answer your questions"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
                {chatMode === "research"
                    ? "Ask research questions and I'll provide comprehensive, well-cited answers using the knowledge base."
                    : "Your documents are indexed. Ask anything about the content."}
            </p>

            {/* Suggested Queries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestedQueries.map((query, index) => (
                    <button
                        key={index}
                        onClick={() => onQueryClick(query.text)}
                        className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
                    >
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 border border-gray-200">
                            {query.icon}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{query.text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

