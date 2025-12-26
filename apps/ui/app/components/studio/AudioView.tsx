import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Share2, Download, Maximize2, Loader2, RefreshCw } from 'lucide-react';

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

interface AudioConfig {
    format: string;
    language: string;
    length: string;
    custom_topic?: string;
}

interface AudioViewProps {
    onExpand?: () => void;
    isModal?: boolean;
    onClose?: () => void;
    sessionId?: string;
    config?: AudioConfig;
}

interface AudioData {
    audio_path: string;
    duration_seconds: number;
    file_size_bytes: number;
    title: string;
    metadata: {
        voice: string;
        language: string;
        format: string;
        word_count: number;
    };
}

const AudioView: React.FC<AudioViewProps> = ({ onExpand, isModal, onClose, sessionId, config }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioData, setAudioData] = useState<AudioData | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateAudio = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/generate-audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    format: config?.format || 'deep_dive',
                    language: config?.language || 'en-US',
                    length: config?.length || 'default',
                    custom_topic: config?.custom_topic,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to generate audio');
            }

            const data = await response.json();
            setAudioData(data);

            // Extract filename from path for audio URL
            const pathParts = data.audio_path.split(/[/\\]/);
            const filename = pathParts[pathParts.length - 1];
            const audioUrl = sessionId
                ? `${RAG_API_URL}/api/rag/audio/${sessionId}/${filename}`
                : `${RAG_API_URL}/api/rag/audio/default/${filename}`;

            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                audioRef.current.load();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate audio');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (audioRef.current && duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            audioRef.current.currentTime = percentage * duration;
        }
    };

    const skipForward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 15, duration);
        }
    };

    const skipBackward = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 15, 0);
        }
    };

    const downloadAudio = () => {
        if (audioData?.audio_path) {
            const pathParts = audioData.audio_path.split(/[/\\]/);
            const filename = pathParts[pathParts.length - 1];
            const audioUrl = sessionId
                ? `${RAG_API_URL}/api/rag/audio/${sessionId}/${filename}`
                : `${RAG_API_URL}/api/rag/audio/default/${filename}`;

            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `${audioData.title || 'audio'}.mp3`;
            a.click();
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

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

                    {isLoading ? (
                        <Loader2 size={60} className="text-white relative z-10 animate-spin" />
                    ) : (
                        <Volume2 size={80} className="text-white relative z-10" />
                    )}

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

                {/* Title and Status */}
                <div className="text-center space-y-2 mb-12 w-full">
                    {error ? (
                        <>
                            <h2 className="text-xl font-bold text-red-600">Generation Failed</h2>
                            <p className="text-sm text-gray-500">{error}</p>
                        </>
                    ) : audioData ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900">{audioData.title}</h2>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">
                                {audioData.metadata.format.replace('_', ' ')} • {formatTime(audioData.duration_seconds)}
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900">Audio Overview</h2>
                            <p className="text-sm font-medium text-gray-500">Generate an audio summary of your documents</p>
                        </>
                    )}
                </div>

                {/* Progress Bar */}
                {audioData && (
                    <div className="w-full space-y-2 mb-8">
                        <div
                            className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden relative group cursor-pointer"
                            onClick={handleSeek}
                        >
                            <div
                                className="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform"
                                style={{ left: `${progress}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration || audioData.duration_seconds)}</span>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-8 mb-12">
                    {audioData ? (
                        <>
                            <button
                                onClick={skipBackward}
                                className="text-gray-400 hover:text-gray-900 transition-colors"
                                title="Skip back 15 seconds"
                            >
                                <SkipBack size={24} />
                            </button>
                            <button
                                onClick={togglePlayPause}
                                className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-600/20 hover:scale-105 transition-all"
                            >
                                {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                            </button>
                            <button
                                onClick={skipForward}
                                className="text-gray-400 hover:text-gray-900 transition-colors"
                                title="Skip forward 15 seconds"
                            >
                                <SkipForward size={24} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={generateAudio}
                            disabled={isLoading}
                            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Generating Audio...
                                </>
                            ) : (
                                <>
                                    <Volume2 size={20} />
                                    Generate Audio Summary
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    {audioData && (
                        <>
                            <button
                                onClick={generateAudio}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100"
                            >
                                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                                Regenerate
                            </button>
                            <button
                                onClick={downloadAudio}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100"
                            >
                                <Download size={16} />
                                Download MP3
                            </button>
                        </>
                    )}
                </div>

                {/* Info */}
                {audioData && (
                    <div className="mt-8 text-center text-xs text-gray-400">
                        <p>Voice: {audioData.metadata.voice} • {audioData.metadata.word_count} words</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioView;
