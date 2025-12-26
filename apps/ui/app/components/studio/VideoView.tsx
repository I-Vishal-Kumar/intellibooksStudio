import React, { useState, useRef } from 'react';
import { Play, Pause, Share2, Download, Maximize2, Settings, Volume2, VolumeX, Loader2, RefreshCw, Film } from 'lucide-react';

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

interface VideoConfig {
    orientation: string;
    detail_level: string;
    custom_focus?: string;
}

interface VideoViewProps {
    onExpand?: () => void;
    isModal?: boolean;
    onClose?: () => void;
    sessionId?: string;
    config?: VideoConfig;
}

interface VideoData {
    video_path: string;
    duration_seconds: number;
    file_size_bytes: number;
    title: string;
    scene_count: number;
    metadata: {
        orientation: string;
        resolution: string;
        detail_level: string;
    };
}

const VideoView: React.FC<VideoViewProps> = ({ onExpand, isModal, onClose, sessionId, config }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoData, setVideoData] = useState<VideoData | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateVideo = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/generate-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    orientation: config?.orientation || 'landscape',
                    detail_level: config?.detail_level || 'standard',
                    custom_focus: config?.custom_focus,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to generate video');
            }

            const data = await response.json();
            setVideoData(data);

            // Extract filename from path for video URL
            const pathParts = data.video_path.split(/[/\\]/);
            const filename = pathParts[pathParts.length - 1];
            const videoUrl = sessionId
                ? `${RAG_API_URL}/api/rag/video/${sessionId}/${filename}`
                : `${RAG_API_URL}/api/rag/video/default/${filename}`;

            if (videoRef.current) {
                videoRef.current.src = videoUrl;
                videoRef.current.load();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate video');
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (videoRef.current && duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            videoRef.current.currentTime = percentage * duration;
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            if (containerRef.current.requestFullscreen) {
                containerRef.current.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    };

    const downloadVideo = () => {
        if (videoData?.video_path) {
            const pathParts = videoData.video_path.split(/[/\\]/);
            const filename = pathParts[pathParts.length - 1];
            const videoUrl = sessionId
                ? `${RAG_API_URL}/api/rag/video/${sessionId}/${filename}`
                : `${RAG_API_URL}/api/rag/video/default/${filename}`;

            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = `${videoData.title || 'video'}.mp4`;
            a.click();
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div ref={containerRef} className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {/* Hidden video element when not generated */}
            <video
                ref={videoRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
            />

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
                {/* Video Player */}
                <div className="aspect-video w-full bg-black rounded-[32px] relative overflow-hidden shadow-2xl group mb-8">
                    {videoData ? (
                        <>
                            <video
                                ref={videoRef}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => setIsPlaying(false)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                className="w-full h-full object-contain"
                                onClick={togglePlayPause}
                            />

                            {/* Play/Pause Overlay */}
                            {!isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <button
                                        onClick={togglePlayPause}
                                        className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 cursor-pointer hover:scale-110 transition-all"
                                    >
                                        <Play size={32} fill="currentColor" className="ml-1" />
                                    </button>
                                </div>
                            )}

                            {/* Video Title Overlay */}
                            <div className="absolute top-6 left-6 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <h3 className="font-bold text-lg">{videoData.title}</h3>
                                <p className="text-xs text-white/60">
                                    {formatTime(videoData.duration_seconds)} • {videoData.metadata.resolution}
                                </p>
                            </div>

                            {/* Bottom Controls */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Progress Bar */}
                                <div
                                    className="h-1 w-full bg-white/20 rounded-full overflow-hidden relative cursor-pointer"
                                    onClick={handleSeek}
                                >
                                    <div
                                        className="absolute inset-y-0 left-0 bg-blue-500 transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-white">
                                    <div className="flex items-center gap-6">
                                        <button onClick={togglePlayPause}>
                                            {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                                        </button>
                                        <button onClick={toggleMute}>
                                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            className="w-20 accent-blue-500"
                                        />
                                        <span className="text-xs font-bold">
                                            {formatTime(currentTime)} / {formatTime(duration || videoData.duration_seconds)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Settings size={18} className="cursor-pointer hover:text-blue-400" />
                                        <button onClick={toggleFullscreen}>
                                            <Maximize2 size={18} className="cursor-pointer hover:text-blue-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                            {isLoading ? (
                                <>
                                    <Loader2 size={60} className="text-white animate-spin mb-4" />
                                    <p className="text-white/80 text-sm">Generating video... This may take a few minutes</p>
                                    <p className="text-white/60 text-xs mt-2">Creating scenes and composing video</p>
                                </>
                            ) : error ? (
                                <>
                                    <Film size={60} className="text-red-400 mb-4" />
                                    <p className="text-red-400 font-semibold">{error}</p>
                                    <button
                                        onClick={generateVideo}
                                        className="mt-4 px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                                    >
                                        Try Again
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Film size={80} className="text-white/80 mb-6" />
                                    <h3 className="text-white font-bold text-xl mb-2">Video Overview</h3>
                                    <p className="text-white/60 text-sm mb-6">Generate a video summary of your documents</p>
                                    <button
                                        onClick={generateVideo}
                                        className="px-8 py-4 bg-white text-indigo-900 rounded-xl font-semibold hover:bg-gray-100 transition-all flex items-center gap-3"
                                    >
                                        <Film size={20} />
                                        Generate Video Summary
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Video Info */}
                {videoData && (
                    <>
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-gray-900 leading-tight">{videoData.title}</h2>
                                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <span>{videoData.scene_count} scenes</span>
                                    <span>•</span>
                                    <span>{videoData.metadata.orientation}</span>
                                    <span>•</span>
                                    <span>{videoData.metadata.resolution}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={generateVideo}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100"
                                >
                                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                                    Regenerate
                                </button>
                                <button
                                    onClick={downloadVideo}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-full text-xs font-bold hover:bg-black transition-all shadow-lg shadow-black/10"
                                >
                                    <Download size={16} />
                                    Download MP4
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mt-8 p-6 bg-gray-50 rounded-[24px] border border-gray-100">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                AI-generated video summary with {videoData.scene_count} scenes.
                                Format: {videoData.metadata.detail_level} detail level in {videoData.metadata.orientation} orientation.
                                Total duration: {formatTime(videoData.duration_seconds)}.
                            </p>
                        </div>
                    </>
                )}

                {/* Generate button when no video */}
                {!videoData && !isLoading && !error && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                        <p>Upload documents to your session first, then generate a video summary.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoView;
