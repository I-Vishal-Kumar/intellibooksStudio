import { FC, RefObject } from "react";
import { Mic, MicOff, Square, X, ArrowUpRight, Loader2 } from "lucide-react";

interface MessageInputProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    inputRef: RefObject<HTMLTextAreaElement | null>;
    hasSources: boolean;
    isUploading: boolean;
    isQuerying: boolean;
    isConnected?: boolean;
    stats?: { total_chunks: number; status: string } | null;
    // Audio recording
    isRecording: boolean;
    duration: number;
    isTranscribing: boolean;
    audioError: string | null;
    startRecording: () => void;
    stopRecording: () => Promise<Blob | void>;
    cancelRecording: () => void;
    formatDuration: (seconds: number) => string;
    onTranscribeAudio: (audioBlob: Blob) => Promise<void>;
}

export const MessageInput: FC<MessageInputProps> = ({
    input,
    setInput,
    onSend,
    inputRef,
    hasSources,
    isUploading,
    isQuerying,
    isConnected = true,
    stats,
    isRecording,
    duration,
    isTranscribing,
    audioError,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
    onTranscribeAudio,
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    // Smart chat can work even without sources (for general chat)
    const isDisabled = isUploading || !isConnected;

    return (
        <div className="p-4 bg-white shrink-0 border-t border-gray-100">
            {/* Recording Indicator */}
            {isRecording && (
                <div className="mb-3 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <div>
                            <span className="text-sm font-medium text-red-700">
                                Recording... {formatDuration(duration)}
                            </span>
                            <p className="text-xs text-gray-500">
                                {isTranscribing
                                    ? "Transcribing audio..."
                                    : "Audio will be transcribed when stopped"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={cancelRecording}
                            disabled={isTranscribing}
                            className="p-1.5 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            title="Cancel recording"
                        >
                            <X className="w-4 h-4 text-red-600" />
                        </button>
                        <button
                            onClick={async () => {
                                const blob = await stopRecording();
                                if (blob) {
                                    await onTranscribeAudio(blob);
                                }
                            }}
                            disabled={isTranscribing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Square className="w-3 h-3" />
                            {isTranscribing ? "Transcribing..." : "Stop"}
                        </button>
                    </div>
                </div>
            )}

            {/* Transcription Status */}
            {isTranscribing && !isRecording && (
                <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm text-blue-700">Transcribing audio...</span>
                </div>
            )}

            {/* Audio Error */}
            {audioError && (
                <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700">{audioError}</p>
                </div>
            )}

            <div className="relative group">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        isUploading
                            ? "Processing documents..."
                            : "Ask anything..."
                    }
                    className="w-full bg-[#f8fafc] border border-gray-200 rounded-2xl py-3 pl-4 pr-32 text-sm outline-none transition-all focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-[200px]"
                    disabled={isDisabled}
                    rows={1}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    {/* Microphone Button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isDisabled}
                        className={`p-2 rounded-xl transition-colors ${
                            isRecording
                                ? "bg-red-100 hover:bg-red-200 text-red-600"
                                : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={isRecording ? "Stop recording" : "Start voice input"}
                    >
                        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    {stats && (
                        <span className="text-[11px] text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded-full shadow-sm">
                            {stats.total_chunks || 0} chunks
                        </span>
                    )}
                    <button
                        onClick={onSend}
                        disabled={!input.trim() || isQuerying || isDisabled}
                        className="w-8 h-8 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors"
                    >
                        {isQuerying ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={18} />}
                    </button>
                </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">
                Smart chat auto-detects when to search your knowledge base
            </p>
        </div>
    );
};
