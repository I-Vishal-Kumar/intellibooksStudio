import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Share2, Download, Maximize2 } from 'lucide-react';

interface AudioViewProps {
    onExpand?: () => void;
    isModal?: boolean;
    onClose?: () => void;
}

const AudioView: React.FC<AudioViewProps> = ({ onExpand, isModal }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {!isModal && (
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span>Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">Audio Overview</span>
                    </div>
                    <button onClick={onExpand} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col items-center justify-center ${isModal ? 'max-w-2xl mx-auto w-full' : ''}`}>
                {/* Audio Artwork / Visualizer */}
                <div className={`aspect-square w-full max-w-[240px] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] shadow-2xl flex items-center justify-center relative overflow-hidden mb-12`}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    <Volume2 size={80} className="text-white relative z-10" />

                    {/* Animated Waves */}
                    {isPlaying && (
                        <div className="absolute bottom-6 flex gap-1 items-end h-8">
                            {[...Array(8)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 bg-white/40 rounded-full animate-bounce"
                                    style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center space-y-2 mb-12 w-full">
                    <h2 className="text-2xl font-bold text-gray-900">jAI Agent DNA Framework</h2>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Deep Dive • 12:45</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full space-y-2 mb-8">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative group cursor-pointer">
                        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-blue-600 transition-all" />
                        <div className="absolute left-1/3 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-gray-400">
                        <span>4:15</span>
                        <span>12:45</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-8 mb-12">
                    <button className="text-gray-400 hover:text-gray-900 transition-colors">
                        <SkipBack size={24} />
                    </button>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-600/20 hover:scale-105 transition-all"
                    >
                        {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                    </button>
                    <button className="text-gray-400 hover:text-gray-900 transition-colors">
                        <SkipForward size={24} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100">
                        <Share2 size={16} />
                        Share
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100">
                        <Download size={16} />
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AudioView;
