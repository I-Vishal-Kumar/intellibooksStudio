import { FC, useState, useRef, useEffect } from "react";
import { useWebSocketContext } from "@/lib/websocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { transcribeAudio } from "@/lib/api";
import { ChatHeader, EmptyState, MessageList, MessageInput } from "./chat";
import DatabaseConfigModal from "./DatabaseConfigModal";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    sources?: Array<{
        id: string;
        content_preview: string;
        score: number;
        metadata: Record<string, unknown>;
    }>;
    metadata?: Record<string, unknown>;
}

interface RAGStats {
    total_chunks: number;
    status: string;
}

interface ChatPanelProps {
    hasSources: boolean;
    onUploadClick?: () => void;
    isUploading?: boolean;
    messages?: Message[];
    onSendMessage?: (message: string) => void;
    onShareClick?: () => void;
    isQuerying?: boolean;
    stats?: RAGStats | null;
    useWebSocket?: boolean;
    sessionId?: string;
    readOnly?: boolean;
}

// Internal component that uses WebSocket context
const ChatPanelInternal: FC<ChatPanelProps & { wsContext?: ReturnType<typeof useWebSocketContext> | null }> = ({
    hasSources,
    isUploading,
    messages: externalMessages = [],
    onSendMessage,
    onShareClick,
    isQuerying: externalIsQuerying = false,
    stats,
    useWebSocket = true,
    wsContext = null,
    readOnly = false,
    sessionId,
}) => {
    const [input, setInput] = useState("");
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isDatabaseConfigOpen, setIsDatabaseConfigOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Only use WebSocket if explicitly enabled and context is available
    const shouldUseWebSocket = useWebSocket && wsContext !== null;
    const wsMessages = shouldUseWebSocket && wsContext ? wsContext.messages : [];
    const wsIsConnected = shouldUseWebSocket && wsContext ? wsContext.isConnected : false;
    const wsProcessingStatus = shouldUseWebSocket && wsContext ? wsContext.processingStatus : null;
    // Use WebSocket sessionId if available, otherwise fall back to prop
    const effectiveSessionId = shouldUseWebSocket && wsContext?.sessionId ? wsContext.sessionId : sessionId;
    const wsIsQuerying =
        shouldUseWebSocket && wsContext
            ? wsContext.status === "connecting" ||
            wsProcessingStatus !== null ||
            (wsMessages.length > 0 &&
                wsMessages[wsMessages.length - 1]?.role === "user" &&
                !wsMessages.some(
                    (m, i) =>
                        i >
                        wsMessages.findIndex(
                            (msg) => msg.id === wsMessages[wsMessages.length - 1]?.id
                        ) &&
                        m.role === "assistant"
                ))
            : false;

    // Use WebSocket messages if available, otherwise fall back to external messages
    const messages: Message[] = shouldUseWebSocket && wsContext
        ? wsMessages
            .filter((msg) => msg.role === "user" || msg.role === "assistant")
            .map((msg) => ({
                id: msg.id,
                role: msg.role as "user" | "assistant",
                content: msg.content,
                timestamp: msg.timestamp,
                sources: Array.isArray(msg.metadata?.sources)
                    ? (msg.metadata!.sources as Array<{
                        id: string;
                        content_preview: string;
                        score: number;
                        metadata: Record<string, unknown>;
                    }>)
                    : [],
                metadata: msg.metadata || {},
            }))
        : externalMessages;

    const isQuerying = shouldUseWebSocket && wsContext ? wsIsQuerying : externalIsQuerying;

    // Audio recording
    const {
        isRecording,
        duration,
        error: audioError,
        startRecording,
        stopRecording,
        cancelRecording,
        formatDuration,
    } = useAudioRecorder({
        onTranscriptionComplete: async (audioBlob: Blob) => {
            if (audioBlob && audioBlob.size > 0) {
                await handleTranscribeAudio(audioBlob);
            }
        },
    });

    // Handle sending audio to backend for transcription
    const handleTranscribeAudio = async (audioBlobToTranscribe: Blob) => {
        if (!audioBlobToTranscribe || audioBlobToTranscribe.size === 0) {
            console.warn("No audio blob provided for transcription");
            return;
        }

        setIsTranscribing(true);
        try {
            const transcribedText = await transcribeAudio(audioBlobToTranscribe);
            if (transcribedText) {
                setInput((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
            }
        } catch (error) {
            console.error("Transcription error:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Failed to transcribe audio";
            setInput(
                (prev) =>
                    prev
                        ? `${prev} [Transcription failed: ${errorMessage}]`
                        : `[Transcription failed: ${errorMessage}]`
            );
        } finally {
            setIsTranscribing(false);
        }
    };

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSend = () => {
        if (!input.trim() || isQuerying) return;

        const trimmedInput = input.trim();
        setInput("");

        if (shouldUseWebSocket && wsContext) {
            const sessionId = wsContext.sessionId || undefined;
            if (sessionId) {
                wsContext.sendMessage(trimmedInput, sessionId);
            }
        } else if (onSendMessage) {
            onSendMessage(trimmedInput);
        }
    };

    const handleQueryClick = (query: string) => {
        setInput(query);
        inputRef.current?.focus();
    };

    const showEmptyState = messages.length === 0;

    return (
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 shadow-sm overflow-hidden">
            <ChatHeader
                stats={stats}
                isConnected={wsIsConnected}
                onShareClick={onShareClick}
                onDatabaseConfigClick={() => setIsDatabaseConfigOpen(true)}
                readOnly={readOnly}
            />

            {/* Database Configuration Modal */}
            {effectiveSessionId && (
                <DatabaseConfigModal
                    isOpen={isDatabaseConfigOpen}
                    onClose={() => setIsDatabaseConfigOpen(false)}
                    sessionId={effectiveSessionId}
                    onConfigSaved={() => {
                        setIsDatabaseConfigOpen(false);
                    }}
                />
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
                {showEmptyState ? (
                    <EmptyState
                        hasSources={hasSources}
                        isUploading={isUploading || false}
                        onQueryClick={handleQueryClick}
                    />
                ) : (
                    <MessageList
                        messages={messages}
                        isQuerying={isQuerying}
                        processingStatus={wsProcessingStatus}
                        messagesEndRef={messagesEndRef}
                    />
                )}
            </div>

            <MessageInput
                input={input}
                setInput={setInput}
                onSend={handleSend}
                inputRef={inputRef}
                hasSources={hasSources}
                isUploading={isUploading || false}
                isQuerying={isQuerying}
                isConnected={shouldUseWebSocket ? wsIsConnected : true}
                stats={stats}
                isRecording={isRecording}
                duration={duration}
                isTranscribing={isTranscribing}
                audioError={audioError}
                startRecording={startRecording}
                stopRecording={stopRecording}
                cancelRecording={cancelRecording}
                formatDuration={formatDuration}
                onTranscribeAudio={handleTranscribeAudio}
                readOnly={readOnly}
            />
        </div>
    );
};

// Main component - always call hook (React requirement)
const ChatPanel: FC<ChatPanelProps> = (props) => {
    const { useWebSocket = true } = props;
    // Always call the hook unconditionally (required by React rules)
    const wsContextRaw = useWebSocketContext();

    // Only use WebSocket if explicitly enabled
    const wsContext = useWebSocket ? wsContextRaw : null;

    return <ChatPanelInternal {...props} wsContext={wsContext} sessionId={props.sessionId} />;
};

export default ChatPanel;
