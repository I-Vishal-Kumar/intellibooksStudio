"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Send,
  Upload,
  FileText,
  Trash2,
  Search,
  BookOpen,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  Sparkles,
  FileUp,
  Clock,
  File,
  MoreHorizontal,
} from "lucide-react";

interface Document {
  id: string;
  filename: string;
  chunks: number;
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
}

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
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
  chunks?: number;
}

const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

export default function KnowledgePage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [stats, setStats] = useState<{ total_chunks: number; status: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${RAG_API_URL}/api/rag/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFiles = async (files: File[]) => {
    const newProgress: UploadProgress[] = files.map((f) => ({
      filename: f.name,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadProgress((prev) => [...prev, ...newProgress]);

    // Upload files in parallel
    const uploadPromises = files.map(async (file, index) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        // Update to processing
        setUploadProgress((prev) =>
          prev.map((p, i) =>
            p.filename === file.name ? { ...p, progress: 50, status: "processing" as const } : p
          )
        );

        const response = await fetch(`${RAG_API_URL}/api/rag/upload`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === file.name
                ? { ...p, progress: 100, status: "done" as const, chunks: result.chunks_created }
                : p
            )
          );

          // Add to documents list
          setDocuments((prev) => [
            {
              id: result.document_id,
              filename: file.name,
              chunks: result.chunks_created,
              uploadedAt: new Date(),
              status: "ready",
            },
            ...prev,
          ]);
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (error) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.filename === file.name
              ? { ...p, status: "error" as const, error: String(error) }
              : p
          )
        );
      }
    });

    await Promise.all(uploadPromises);
    fetchStats();

    // Clear completed uploads after 3 seconds
    setTimeout(() => {
      setUploadProgress((prev) => prev.filter((p) => p.status !== "done"));
    }, 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleQuery = async () => {
    if (!input.trim() || isQuerying) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsQuerying(true);

    try {
      const response = await fetch(`${RAG_API_URL}/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content, top_k: 5 }),
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
        sources: result.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error while querying the knowledge base. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  const clearKnowledgeBase = async () => {
    if (!confirm("Are you sure you want to clear all documents from the knowledge base?")) {
      return;
    }

    try {
      await fetch(`${RAG_API_URL}/api/rag/clear`, { method: "DELETE" });
      setDocuments([]);
      fetchStats();
    } catch (error) {
      console.error("Failed to clear knowledge base:", error);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const suggestedQueries = [
    { icon: <Search className="w-5 h-5" />, text: "What are the main topics in my documents?" },
    { icon: <BookOpen className="w-5 h-5" />, text: "Summarize the key points" },
    { icon: <FileText className="w-5 h-5" />, text: "Find information about..." },
    { icon: <Sparkles className="w-5 h-5" />, text: "What insights can you provide?" },
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Knowledge Base</h2>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">
                {stats?.total_chunks || 0} chunks
              </span>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-medium"
          >
            <Upload className="w-5 h-5" />
            Upload Documents
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.html,.json,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="p-3 border-b border-gray-200 space-y-2">
            {uploadProgress.map((progress, i) => (
              <div key={i} className="bg-white rounded-lg p-2 border border-gray-200">
                <div className="flex items-center gap-2">
                  {progress.status === "uploading" && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {progress.status === "processing" && (
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  )}
                  {progress.status === "done" && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {progress.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-xs text-gray-600 truncate flex-1">
                    {progress.filename}
                  </span>
                </div>
                {progress.status === "done" && progress.chunks && (
                  <p className="text-xs text-green-600 mt-1">
                    {progress.chunks} chunks created
                  </p>
                )}
                {progress.status === "error" && (
                  <p className="text-xs text-red-600 mt-1">{progress.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 px-3 py-2">
              Recent Documents
            </p>
            {documents.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">
                No documents uploaded yet
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {doc.chunks} chunks
                    </p>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all">
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={clearKnowledgeBase}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear Knowledge Base
          </button>
          <div className="flex items-center gap-3 mt-4">
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

      {/* Main Content Area */}
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
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">Knowledge Base</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                stats?.status === "ready"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {stats?.status === "ready" ? "Ready" : "Initializing..."}
            </span>
          </div>
        </header>

        {/* Drag & Drop Overlay */}
        {dragActive && (
          <div
            className="absolute inset-0 bg-purple-500/10 border-2 border-dashed border-purple-500 z-50 flex items-center justify-center"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <FileUp className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-purple-700">
                Drop files to upload
              </p>
              <p className="text-sm text-purple-600">
                PDF, DOCX, TXT, MD, HTML, JSON, CSV
              </p>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Query Your Knowledge Base
              </h1>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Upload documents and ask questions. I'll find relevant information
                and provide AI-powered answers.
              </p>

              {/* Upload Area */}
              <div
                className="w-full max-w-2xl mb-8 p-8 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Drag & drop files or click to upload
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports PDF, DOCX, TXT, MD, HTML, JSON, CSV
                  </p>
                </div>
              </div>

              {/* Suggested Queries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestedQueries.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(query.text)}
                    disabled={stats?.total_chunks === 0}
                    className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-gray-200 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 border border-gray-200">
                      {query.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {query.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="max-w-3xl mx-auto px-4 py-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-6 ${
                    message.role === "user" ? "flex justify-end" : ""
                  }`}
                >
                  <div
                    className={`${
                      message.role === "user"
                        ? "bg-purple-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]"
                        : "flex gap-4"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={message.role === "user" ? "" : "flex-1"}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Sources ({message.sources.length})
                          </p>
                          <div className="space-y-2">
                            {message.sources.slice(0, 3).map((source, i) => (
                              <div
                                key={i}
                                className="p-2 bg-gray-50 rounded-lg border border-gray-100"
                              >
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {source.content_preview}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Relevance: {(source.score * 100).toFixed(0)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
              {isQuerying && (
                <div className="flex gap-4 mb-6">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                    <span className="text-sm text-gray-500">
                      Searching knowledge base...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  stats?.total_chunks === 0
                    ? "Upload documents first to start querying..."
                    : "Ask a question about your documents..."
                }
                disabled={stats?.total_chunks === 0}
                className="flex-1 px-4 py-3 bg-transparent border-0 resize-none focus:outline-none text-gray-900 placeholder-gray-400 max-h-[200px] disabled:cursor-not-allowed"
                rows={1}
              />
              <button
                onClick={handleQuery}
                disabled={!input.trim() || isQuerying || stats?.total_chunks === 0}
                className="m-2 p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              {stats?.total_chunks === 0
                ? "Upload documents to enable querying"
                : "Answers are generated based on your uploaded documents"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
