import { FC } from "react";
import * as Icons from "lucide-react";
import { ChevronDown, PanelLeftClose, PanelLeft, FileText, Check, Plus } from "lucide-react";
import SourceItem from "./SourceItem";

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
    sources: any[];
    isUploading?: boolean;
    onAddSource?: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggle, sources, isUploading, onAddSource }) => {
    if (isCollapsed) {
        return (
            <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 transition-all duration-300">
                <button onClick={onToggle} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <PanelLeft size={20} />
                </button>
                <button onClick={onAddSource} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <Plus size={20} />
                </button>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <span className="font-semibold text-gray-700 truncate mr-2">Sources</span>
                <button onClick={onToggle} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                    <PanelLeftClose size={18} />
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {sources.length === 0 && !isUploading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors" onClick={onAddSource}>
                            <FileText size={48} className="text-gray-300" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-400">Saved sources will appear here</p>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium px-4">
                                Click Add source above to add PDFs, websites, text, videos, or audio files.
                                Or import a file directly from Google Drive.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto min-h-0">
                        {/* Add sources button */}
                        <button
                            onClick={onAddSource}
                            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-full py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm shrink-0"
                        >
                            <Plus size={18} className="text-gray-400" />
                            <span>Add sources</span>
                        </button>

                        {!isUploading && (
                            <>
                                {/* Deep Research Tip */}
                                <div className="bg-[#f0f9ff] border border-[#e0f2fe] p-3 rounded-xl flex gap-3 items-start cursor-pointer hover:bg-[#e0f2fe] transition-colors group shrink-0">
                                    <div className="p-1.5 bg-white rounded-lg shadow-sm border border-blue-50 shrink-0">
                                        <Icons.Search size={16} className="text-blue-500" />
                                    </div>
                                    <p className="text-xs text-blue-900 leading-normal font-medium">
                                        Try <span className="font-semibold text-blue-600">Deep Research</span> for an in-depth report and new sources!
                                    </p>
                                </div>

                                {/* Search box section */}
                                <div className="space-y-3">
                                    <div className="relative group shrink-0">
                                        <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search the web for new sources"
                                            className="w-full bg-[#f8fafc] border border-gray-100 focus:border-blue-200 hover:border-gray-200 focus:bg-white focus:ring-4 focus:ring-blue-500/5 rounded-xl py-2.5 pl-10 pr-8 text-sm outline-none transition-all truncate"
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button className="flex-1 flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Icons.Globe size={14} className="text-gray-500" />
                                                <span>Web</span>
                                            </div>
                                            <ChevronDown size={14} className="text-gray-400" />
                                        </button>
                                        <button className="flex-[1.5] flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Icons.Zap size={14} className="text-gray-500" />
                                                <span>Fast Research</span>
                                            </div>
                                            <ChevronDown size={14} className="text-gray-400" />
                                        </button>
                                        <button className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-all shrink-0">
                                            <Icons.ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Loading State / Existing Sources */}
                        <div className="mt-2 space-y-1 min-h-0">
                            {isUploading && (
                                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg transition-colors shrink-0">
                                    <div className="p-2 bg-rose-50 rounded text-rose-600 shrink-0">
                                        <FileText size={16} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 flex-1 truncate">jAI-Agent-Framework.pdf</span>
                                    <div className="relative w-4 h-4 shrink-0">
                                        <div className="absolute inset-0 border-2 border-blue-100 rounded-full"></div>
                                        <div className="absolute inset-0 border-2 border-blue-50 rounded-full border-t-transparent animate-spin"></div>
                                    </div>
                                </div>
                            )}

                            {!isUploading && sources.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between py-2 px-1 text-xs font-semibold text-gray-500 shrink-0">
                                        <span className="truncate mr-2 text-[11px] uppercase tracking-wider">Select all sources</span>
                                        <div className="w-4 h-4 border-2 border-gray-200 rounded hover:border-blue-400 transition-colors cursor-pointer shrink-0"></div>
                                    </div>

                                    {sources.map((source) => (
                                        <div key={source.id} className="flex items-center gap-3 p-1.5 group cursor-pointer hover:bg-gray-50 rounded-lg transition-colors shrink-0">
                                            <div className="p-1.5 bg-rose-50 rounded text-rose-500 shrink-0 border border-rose-100">
                                                <FileText size={14} />
                                            </div>
                                            <span className="text-xs font-medium text-gray-600 flex-1 truncate">{source.title}</span>
                                            <div className="w-4 h-4 border-2 border-gray-200 rounded group-hover:border-blue-400 transition-colors shrink-0"></div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
