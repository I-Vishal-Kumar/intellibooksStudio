import { FC } from "react";
import { SlidersHorizontal, MoreVertical, PlusSquare, Copy, ThumbsUp, ThumbsDown, ArrowUpRight, Search, Upload } from "lucide-react";

interface ChatPanelProps {
    hasSources: boolean;
    onUploadClick?: () => void;
    isUploading?: boolean;
}

const ChatPanel: FC<ChatPanelProps> = ({ hasSources, onUploadClick, isUploading }) => {
    return (
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <span className="font-semibold text-gray-700">Chat</span>
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
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-pulse">
                        <div className="w-24 h-32 bg-amber-50 rounded-lg border-2 border-amber-200 flex flex-col items-center justify-center shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-200"></div>
                            <div className="w-12 h-16 bg-white rounded flex flex-col p-1 gap-1">
                                <div className="h-1 bg-gray-100 rounded w-full"></div>
                                <div className="h-1 bg-gray-100 rounded w-2/3"></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-semibold text-gray-900">Untitled notebook</h3>
                            <p className="text-sm text-gray-500 font-medium">1 source</p>
                        </div>
                    </div>
                ) : !hasSources ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                            <Upload size={32} />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl font-semibold text-gray-900">Add a source to get started</h3>
                            <button
                                onClick={onUploadClick}
                                className="px-8 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                            >
                                Upload a source
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-8">
                        <div className="space-y-4">
                            <div className="text-gray-800 leading-relaxed">
                                <span className="font-bold">and Banking</span>{" "}
                                <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">1</span>{" "}
                                , <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">21</span>{" "}
                                , <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">22</span>{" "}
                                . It utilizes specialized schemas—such as an <span className="font-bold">Insurance Knowledge Graph</span>—to map relationships between customers, vehicles, policies, and regulations{" "}
                                <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">17</span>{" "}
                                , <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">23</span>{" "}
                                . This allows agents to perform complex, multi-hop reasoning, such as identifying fraud patterns across related policyholders at the same address{" "}
                                <span className="inline-flex items-center justify-center bg-gray-100 text-[10px] text-gray-500 w-4 h-4 rounded-full mx-0.5">24</span>{" "}
                                .
                            </div>

                            <div className="border-t border-dashed border-gray-200 pt-6">
                                <p className="text-gray-800 leading-relaxed">
                                    <span className="font-bold">Analogy for Understanding:</span> Think of the <span className="font-bold">jAI Platform</span> as a highly advanced skyscraper. The <span className="font-bold">Agent Framework</span> is the architectural blueprint that gives every office (the agents) its specific layout, tools, and security protocols. The <span className="font-bold">Platform Services</span> are the buildins infrastructure—the elevators, power grid, and communication lines—that allow all the offices to work together as a single, perfectly coordinated unit to run an entire global corporation.
                                </p>
                            </div>

                            {/* Action Row */}
                            <div className="flex items-center gap-4 pt-2">
                                <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm bg-white">
                                    <PlusSquare size={16} />
                                    Save to note
                                </button>
                                <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Copy size={16} />
                                </button>
                                <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <ThumbsUp size={16} />
                                </button>
                                <button className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <ThumbsDown size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white shrink-0">
                <div className="relative group">
                    <input
                        type="text"
                        placeholder={hasSources || isUploading ? "Start typing..." : "Upload a source to get started"}
                        className="w-full bg-[#f8fafc] border border-gray-200 rounded-2xl py-3 pl-4 pr-32 text-sm outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200"
                        disabled={!hasSources && !isUploading}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <span className="text-[11px] text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">
                            {hasSources || isUploading ? "1 source" : "0 sources"}
                        </span>
                        <button className="w-8 h-8 bg-[#e2e8f0] text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                            <ArrowUpRight size={18} />
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">NotebookLM can be inaccurate; please double check its responses.</p>
            </div>
        </div>
    );
};

export default ChatPanel;
