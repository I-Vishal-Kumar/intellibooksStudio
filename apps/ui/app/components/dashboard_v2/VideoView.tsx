import React from 'react';
import { Play, Share2, Download, Maximize2, MoreVertical, Settings, Volume2 } from 'lucide-react';

interface VideoViewProps {
    onExpand?: () => void;
    isModal?: boolean;
    onClose?: () => void;
}

const VideoView: React.FC<VideoViewProps> = ({ onExpand, isModal }) => {
    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {!isModal && (
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span>Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">Video Overview</span>
                    </div>
                    <button onClick={onExpand} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col ${isModal ? 'max-w-4xl mx-auto w-full' : ''}`}>
                {/* Video Player Mockup */}
                <div className="aspect-video w-full bg-black rounded-[32px] relative overflow-hidden shadow-2xl group mb-8">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 cursor-pointer hover:scale-110 transition-all">
                            <Play size={32} fill="currentColor" className="ml-1" />
                        </div>
                    </div>

                    {/* Video Title Overlay */}
                    <div className="absolute top-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <h3 className="font-bold text-lg">AI Summary: Framework Architecture</h3>
                        <p className="text-xs text-white/60">3:42 • 4K HDR</p>
                    </div>

                    {/* Simple Bottom Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 w-1/4 bg-blue-500" />
                        </div>
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-6">
                                <Play size={20} fill="currentColor" />
                                <Volume2 size={20} />
                                <span className="text-xs font-bold">0:58 / 3:42</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <Settings size={18} />
                                <Maximize2 size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight">jAI Agent Architecture Breakdown</h2>
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <span>1.2k views</span>
                            <span>•</span>
                            <span>2 mins ago</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100">
                            <Share2 size={16} />
                            Share
                        </button>
                        <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-full text-xs font-bold hover:bg-black transition-all shadow-lg shadow-black/10">
                            <Download size={16} />
                            Save
                        </button>
                        <button className="p-2.5 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-full border border-gray-100 transition-colors">
                            <MoreVertical size={18} />
                        </button>
                    </div>
                </div>

                {/* Description Mockup */}
                <div className="mt-8 p-6 bg-gray-50 rounded-[24px] border border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed">
                        A cinematic visualization of the 13 core characteristics of the jAI Agent Framework.
                        This overview covers multi-agent collaboration, A2A protocols, and enterprise scaling strategies.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VideoView;
