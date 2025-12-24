import { FC, useState } from "react";
import * as Icons from "lucide-react";
import {
    ChevronDown,
    PanelLeftClose,
    PanelLeft,
    FileText,
    Plus,
    Trash2,
    Loader2,
    CheckCircle,
    AlertCircle,
    Database,
    MoreHorizontal,
    X,
    BookOpen,
    Upload,
    AlertTriangle,
    ServerCrash
} from "lucide-react";

interface UploadProgress {
    filename: string;
    progress: number;
    status: "uploading" | "processing" | "done" | "error";
    error?: string;
    chunks?: number;
}

interface RAGStats {
    total_chunks: number;
    status: string;
}

interface Source {
    id: string;
    title: string;
    chunks?: number;
    status?: string;
}

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    sources: Source[];
    isUploading?: boolean;
    onAddSource?: () => void;
    uploadProgress?: UploadProgress[];
    onDeleteSource?: (id: string) => void;
    onClearAll?: () => void;
    onClearKnowledgeBase?: () => Promise<void>;
    stats?: RAGStats | null;
}

const Sidebar: FC<SidebarProps> = ({
    isCollapsed,
    onToggle,
    sources,
    isUploading,
    onAddSource,
    uploadProgress = [],
    onDeleteSource,
    onClearAll,
    onClearKnowledgeBase,
    stats
}) => {
    const [showClearKBConfirm, setShowClearKBConfirm] = useState(false);
    const [isClearingKB, setIsClearingKB] = useState(false);

    const handleClearKnowledgeBase = async () => {
        if (!onClearKnowledgeBase) return;
        setIsClearingKB(true);
        try {
            await onClearKnowledgeBase();
            setShowClearKBConfirm(false);
        } catch (error) {
            console.error("Failed to clear knowledge base:", error);
        } finally {
            setIsClearingKB(false);
        }
    };
    if (isCollapsed) {
        return (
            <div className="w-12 bg-white border border-gray-200 rounded-2xl flex flex-col items-center py-4 gap-4 transition-all duration-300 shadow-sm">
                <button onClick={onToggle} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <PanelLeft size={20} />
                </button>
                <button onClick={onAddSource} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <Plus size={20} />
                </button>
                {stats && stats.total_chunks > 0 && (
                    <div className="flex flex-col items-center gap-1">
                        <Database size={16} className="text-purple-500" />
                        <span className="text-[10px] text-gray-400">{stats.total_chunks}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700 truncate mr-2">Sources</span>
                    {stats && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Database size={12} />
                            {stats.total_chunks}
                        </span>
                    )}
                </div>
                <button onClick={onToggle} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                    <PanelLeftClose size={18} />
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {sources.length === 0 && !isUploading && uploadProgress.length === 0 ? (
                    // Empty state with welcome message
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <BookOpen size={28} className="text-white" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-gray-900">Query Your Knowledge Base</h3>
                            <p className="text-xs text-gray-500 leading-relaxed px-2">
                                Upload documents and ask questions. I'll find relevant information and provide AI-powered answers.
                            </p>
                        </div>
                        <button
                            onClick={onAddSource}
                            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full py-2.5 px-6 text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
                        >
                            <Upload size={16} />
                            <span>Upload a source</span>
                        </button>
                        <p className="text-[10px] text-gray-400 leading-relaxed px-4">
                            Supports PDF, DOCX, TXT, Markdown, HTML, JSON, CSV
                        </p>
                    </div>
                ) : (
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto min-h-0">
                        {/* Add sources button */}
                        <button
                            onClick={onAddSource}
                            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full py-2.5 px-4 text-sm font-medium transition-all shadow-sm shrink-0"
                        >
                            <Plus size={18} />
                            <span>Add sources</span>
                        </button>

                        {/* Upload Progress */}
                        {uploadProgress.length > 0 && (
                            <div className="space-y-2">
                                {uploadProgress.map((progress, i) => (
                                    <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            {progress.status === "uploading" && (
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                                </div>
                                            )}
                                            {progress.status === "processing" && (
                                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                                                </div>
                                            )}
                                            {progress.status === "done" && (
                                                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                </div>
                                            )}
                                            {progress.status === "error" && (
                                                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {progress.filename}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {progress.status === "uploading" && "Uploading..."}
                                                    {progress.status === "processing" && "Processing & indexing..."}
                                                    {progress.status === "done" && `${progress.chunks} chunks indexed`}
                                                    {progress.status === "error" && "Failed"}
                                                </p>
                                            </div>
                                        </div>
                                        {(progress.status === "uploading" || progress.status === "processing") && (
                                            <div className="mt-2">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            progress.status === "uploading"
                                                                ? "bg-blue-500 w-1/3"
                                                                : "bg-purple-500 w-2/3 animate-pulse"
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {progress.status === "error" && progress.error && (
                                            <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">
                                                {progress.error}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Deep Research Tip - only show when not uploading */}
                        {!isUploading && sources.length > 0 && (
                            <div className="bg-[#f0f9ff] border border-[#e0f2fe] p-3 rounded-xl flex gap-3 items-start cursor-pointer hover:bg-[#e0f2fe] transition-colors group shrink-0">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-blue-50 shrink-0">
                                    <Icons.Search size={16} className="text-blue-500" />
                                </div>
                                <p className="text-xs text-blue-900 leading-normal font-medium">
                                    Try <span className="font-semibold text-blue-600">Deep Research</span> for an in-depth report and new sources!
                                </p>
                            </div>
                        )}

                        {/* Search box section - only show when not uploading and has sources */}
                        {!isUploading && sources.length > 0 && (
                            <div className="space-y-3">
                                <div className="relative group shrink-0">
                                    <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search your sources..."
                                        className="w-full bg-[#f8fafc] border border-gray-100 focus:border-purple-200 hover:border-gray-200 focus:bg-white focus:ring-4 focus:ring-purple-500/5 rounded-xl py-2.5 pl-10 pr-8 text-sm outline-none transition-all truncate"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Sources List */}
                        {sources.length > 0 && !isUploading && (
                            <div className="mt-2 space-y-1 min-h-0">
                                <div className="flex items-center justify-between py-2 px-1 text-xs font-semibold text-gray-500 shrink-0">
                                    <span className="truncate mr-2 text-[11px] uppercase tracking-wider">
                                        {sources.length} source{sources.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {sources.map((source) => (
                                    <div
                                        key={source.id}
                                        className="flex items-center gap-3 p-2 group cursor-pointer hover:bg-gray-50 rounded-lg transition-colors shrink-0"
                                    >
                                        <div className="p-1.5 bg-rose-50 rounded text-rose-500 shrink-0 border border-rose-100">
                                            <FileText size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-medium text-gray-600 block truncate">
                                                {source.title}
                                            </span>
                                            {source.chunks && (
                                                <span className="text-[10px] text-gray-400">
                                                    {source.chunks} chunks
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteSource?.(source.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-all text-gray-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Loading placeholder during upload */}
                        {isUploading && (
                            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg transition-colors shrink-0">
                                <div className="p-2 bg-purple-50 rounded text-purple-600 shrink-0">
                                    <FileText size={16} />
                                </div>
                                <span className="text-xs font-medium text-gray-700 flex-1 truncate">Processing...</span>
                                <div className="relative w-4 h-4 shrink-0">
                                    <div className="absolute inset-0 border-2 border-purple-100 rounded-full"></div>
                                    <div className="absolute inset-0 border-2 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer with Clear buttons */}
            {(sources.length > 0 || (stats && stats.total_chunks > 0)) && (
                <div className="p-4 border-t border-gray-100 space-y-2">
                    {sources.length > 0 && (
                        <button
                            onClick={onClearAll}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear Session Sources
                        </button>
                    )}
                    {stats && stats.total_chunks > 0 && (
                        <button
                            onClick={() => setShowClearKBConfirm(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-sm font-medium border border-orange-200"
                        >
                            <ServerCrash className="w-4 h-4" />
                            Clear Entire Knowledge Base
                        </button>
                    )}
                </div>
            )}

            {/* Clear Knowledge Base Confirmation Modal */}
            {showClearKBConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Clear Entire Knowledge Base?</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                            <p className="text-sm text-red-800 leading-relaxed">
                                This will permanently delete <strong>all documents and embeddings</strong> from ChromaDB
                                (both Docker and local instances). All {stats?.total_chunks || 0} chunks will be removed.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowClearKBConfirm(false)}
                                disabled={isClearingKB}
                                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearKnowledgeBase}
                                disabled={isClearingKB}
                                className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isClearingKB ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Clear Everything
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
