"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { useWebSocketContext } from "@/lib/websocket";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { transcribeAudio } from "@/lib/api";
import {
  Send,
  Plus,
  MessageSquare,
  Mic,
  MicOff,
  FileAudio,
  Brain,
  Languages,
  Sparkles,
  Clock,
  ChevronLeft,
  MoreHorizontal,
  Share2,
  PanelLeftClose,
  PanelLeft,
  Square,
  X,
  Users,
} from "lucide-react";
import { MeetingsModal } from "@/components/chat";
interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

export default function ChatPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const {
    messages,
    sendMessage,
    error: wsError,
    isConnected,
    sessionId,
  } = useWebSocketContext();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isMeetingsModalOpen, setIsMeetingsModalOpen] = useState(false);

  // Audio recording
  const {
    isRecording,
    duration,
    audioBlob,
    error: audioError,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  } = useAudioRecorder({
    onTranscriptionComplete: async (audioBlob: Blob) => {
      // When recording stops, automatically transcribe
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
      console.log("Starting transcription, audio size:", audioBlobToTranscribe.size);
      const transcribedText = await transcribeAudio(audioBlobToTranscribe);
      console.log("Transcription result:", transcribedText);
      
      if (transcribedText) {
        // Append transcribed text to input
        setInput((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
      }
    } catch (error) {
      console.error("Transcription error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to transcribe audio";
      setInput((prev) => (prev ? `${prev} [Transcription failed: ${errorMessage}]` : `[Transcription failed: ${errorMessage}]`));
    } finally {
      setIsTranscribing(false);
    }
  };

  const [chatSessions] = useState<ChatSession[]>(() => [
    {
      id: "1",
      title: "Audio Transcription Help",
      lastMessage: "How do I transcribe audio files?",
      timestamp: DateTime.now().minus({ hours: 1 }).toJSDate(),
    },
    {
      id: "2",
      title: "Translation Query",
      lastMessage: "Translate this to Spanish",
      timestamp: DateTime.now().minus({ days: 1 }).toJSDate(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

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

  // Reset loading when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  }, [messages]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim() || isLoading || !isConnected) return;

    const success = sendMessage(input.trim(), sessionId || "");
    if (success) {
      setInput("");
      setIsLoading(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    window.location.reload();
  };

  const suggestedPrompts = [
    { icon: <Mic className="w-5 h-5" />, text: "Transcribe my audio file" },
    { icon: <Languages className="w-5 h-5" />, text: "Translate to Spanish" },
    { icon: <FileAudio className="w-5 h-5" />, text: "Summarize this recording" },
    { icon: <Brain className="w-5 h-5" />, text: "Analyze intent and keywords" },
  ];

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 px-3 py-2">Today</p>
            {chatSessions.map((session) => (
              <button
                key={session.id}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-left group"
              >
                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {session.lastMessage}
                  </p>
                </div>
                <span className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all">
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer - User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5 text-gray-600" />
              ) : (
                <PanelLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">IB</span>
              </div>
              <span className="font-semibold text-gray-900">Intellibooks Chat</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMeetingsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <Users className="w-4 h-4" />
              Meetings
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-16 h-16 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                How can I help you today?
              </h1>
              <p className="text-gray-500 text-center max-w-md mb-8">
                I can help you transcribe, translate, summarize, and analyze your audio files.
              </p>

              {/* Suggested Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(prompt.text)}
                    className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-gray-200">
                      {prompt.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {prompt.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`mb-6 ${
                    message.role === "user" ? "flex justify-end" : ""
                  }`}
                >
                  <div
                    className={`${
                      message.role === "user"
                        ? "bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]"
                        : "flex gap-4"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">IB</span>
                      </div>
                    )}
                    <div className={message.role === "user" ? "" : "flex-1"}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.role === "assistant" && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 mb-6">
                  <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">IB</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Connection Error */}
        {wsError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-center">
            <p className="text-sm text-red-600">Connection error: {wsError}</p>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-3xl mx-auto">
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
                      await stopRecording();
                      // Transcription will be triggered automatically via onTranscriptionComplete
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

            <div className="relative flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              {/* Microphone Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!isConnected}
                className={`m-2 p-2 rounded-xl transition-colors ${
                  isRecording
                    ? "bg-red-100 hover:bg-red-200 text-red-600"
                    : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? "Listening... speak now"
                    : isConnected
                    ? "Ask anything about your audio..."
                    : "Connecting..."
                }
                disabled={!isConnected}
                className="flex-1 px-2 py-3 bg-transparent border-0 resize-none focus:outline-none text-gray-900 placeholder-gray-400 max-h-[200px]"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !isConnected}
                className="m-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              {isRecording
                ? "Click the microphone or 'Stop' to finish recording"
                : "Intellibooks AI can make mistakes. Verify important information."}
            </p>
          </div>
        </div>
      </div>

      {/* Meetings Modal */}
      <MeetingsModal
        isOpen={isMeetingsModalOpen}
        onClose={() => setIsMeetingsModalOpen(false)}
      />
    </div>
  );
}
