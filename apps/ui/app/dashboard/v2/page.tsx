"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Sidebar from "@/components/dashboard_v2/Sidebar";
import ChatPanel from "@/components/dashboard_v2/ChatPanel";
import StudioPanel from "@/components/dashboard_v2/StudioPanel";
import Header from "@/components/dashboard_v2/Header";
import ResizeHandle from "@/components/dashboard_v2/ResizeHandle";
import ArchitectureView from "@/components/dashboard_v2/ArchitectureView";
import UploadModal from "@/components/dashboard_v2/UploadModal";
import FlashcardsView from "@/components/dashboard_v2/FlashcardsView";
import ReportView from "@/components/dashboard_v2/ReportView";
import QuizView from "@/components/dashboard_v2/QuizView";
import StudioCustomizationModal from "@/components/dashboard_v2/StudioCustomizationModal";
import AudioView from "@/components/dashboard_v2/AudioView";
import VideoView from "@/components/dashboard_v2/VideoView";
import InfographicView from "@/components/dashboard_v2/InfographicView";
import SlideDeckView from "@/components/dashboard_v2/SlideDeckView";
import { WebSocketProvider } from "@/lib/websocket";
import dummyData from "../../../dummy_data/dummy_data.json";

// RAG API Configuration
const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

// Types for RAG integration
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

interface RAGStats {
    total_chunks: number;
    status: string;
}

export default function DashboardV2() {
    const { isSignedIn, isLoaded } = useUser();
    const router = useRouter();

    // Panel state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [studioWidth, setStudioWidth] = useState(384);

    // Modal view states
    const [showArchitecture, setShowArchitecture] = useState(false);
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showAudio, setShowAudio] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [showInfographic, setShowInfographic] = useState(false);
    const [showSlideDeck, setShowSlideDeck] = useState(false);

    // Customization Modal
    const [showCustomization, setShowCustomization] = useState(false);
    const [customizationType, setCustomizationType] = useState('');
    const [pendingGeneration, setPendingGeneration] = useState<string | undefined>(undefined);

    // RAG State
    const [documents, setDocuments] = useState<Document[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isQuerying, setIsQuerying] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const [stats, setStats] = useState<RAGStats | null>(null);
    const [notebookTitle, setNotebookTitle] = useState("Untitled Notebook");

    const containerRef = useRef<HTMLDivElement>(null);

    // Redirect if not signed in
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/sign-in");
        }
    }, [isLoaded, isSignedIn, router]);

    // Fetch RAG stats on mount
    useEffect(() => {
        fetchStats();
    }, []);

    // Update notebook title based on first document
    useEffect(() => {
        if (documents.length > 0 && notebookTitle === "Untitled Notebook") {
            const firstDoc = documents[0];
            const name = firstDoc.filename.replace(/\.[^/.]+$/, ""); // Remove extension
            setNotebookTitle(name);
        }
    }, [documents, notebookTitle]);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/stats`);
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    };

    // File upload handler
    const handleFileUpload = async (files: File[]) => {
        const newProgress: UploadProgress[] = files.map((f) => ({
            filename: f.name,
            progress: 0,
            status: "uploading" as const,
        }));
        setUploadProgress((prev) => [...prev, ...newProgress]);

        const uploadPromises = files.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            try {
                setUploadProgress((prev) =>
                    prev.map((p) =>
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

        setTimeout(() => {
            setUploadProgress((prev) => prev.filter((p) => p.status !== "done"));
        }, 3000);
    };

    // Text/URL upload handler
    const handleTextUpload = async (content: string, type: 'text' | 'website' | 'youtube') => {
        const filename = type === 'text' ? 'Pasted Text' : content.substring(0, 50) + '...';

        setUploadProgress((prev) => [...prev, {
            filename,
            progress: 0,
            status: "uploading" as const,
        }]);

        try {
            setUploadProgress((prev) =>
                prev.map((p) =>
                    p.filename === filename ? { ...p, progress: 50, status: "processing" as const } : p
                )
            );

            // For now, we'll create a text blob and upload it
            // In the future, you might want dedicated endpoints for URL scraping
            const blob = new Blob([content], { type: 'text/plain' });
            const file = new File([blob], `${type}_content_${Date.now()}.txt`, { type: 'text/plain' });

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${RAG_API_URL}/api/rag/upload`, {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                setUploadProgress((prev) =>
                    prev.map((p) =>
                        p.filename === filename
                            ? { ...p, progress: 100, status: "done" as const, chunks: result.chunks_created }
                            : p
                    )
                );

                setDocuments((prev) => [
                    {
                        id: result.document_id,
                        filename: filename,
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
                    p.filename === filename
                        ? { ...p, status: "error" as const, error: String(error) }
                        : p
                )
            );
        }

        fetchStats();
        setTimeout(() => {
            setUploadProgress((prev) => prev.filter((p) => p.status !== "done"));
        }, 3000);
    };

    // RAG Query handler
    const handleQuery = async (query: string) => {
        if (!query.trim() || isQuerying) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: query.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsQuerying(true);

        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query.trim(), top_k: 5 }),
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

    // Delete document
    const handleDeleteDocument = async (documentId: string) => {
        try {
            await fetch(`${RAG_API_URL}/api/rag/document/${documentId}`, { method: "DELETE" });
            setDocuments((prev) => prev.filter((d) => d.id !== documentId));
            fetchStats();
        } catch (error) {
            console.error("Failed to delete document:", error);
        }
    };

    // Clear all documents
    const handleClearAll = async () => {
        if (!confirm("Are you sure you want to clear all documents from the knowledge base?")) {
            return;
        }

        try {
            await fetch(`${RAG_API_URL}/api/rag/clear`, { method: "DELETE" });
            setDocuments([]);
            setMessages([]);
            setNotebookTitle("Untitled Notebook");
            fetchStats();
        } catch (error) {
            console.error("Failed to clear knowledge base:", error);
        }
    };

    // Panel resize handlers
    const startResizingSidebar = useCallback((mouseDownEvent: React.MouseEvent) => {
        const startX = mouseDownEvent.pageX;
        const startWidth = sidebarWidth;

        const onMouseMove = (mouseMoveEvent: MouseEvent) => {
            const newWidth = startWidth + mouseMoveEvent.pageX - startX;
            if (newWidth >= 200 && newWidth <= 450) {
                setSidebarWidth(newWidth);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "default";
            document.body.style.userSelect = "auto";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [sidebarWidth]);

    const startResizingStudio = useCallback((mouseDownEvent: React.MouseEvent) => {
        const startX = mouseDownEvent.pageX;

        const onMouseMove = (mouseMoveEvent: MouseEvent) => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = containerRect.right - mouseMoveEvent.clientX;
            if (newWidth >= 250 && newWidth <= 500) {
                setStudioWidth(newWidth);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "default";
            document.body.style.userSelect = "auto";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    // Studio item click handler
    const handleItemClickFromStudio = (label: string) => {
        if (label === 'Mind Map' || label === 'Reports') {
            handleGenerateContent({}, label);
            return;
        }
        setCustomizationType(label);
        setShowCustomization(true);
    };

    const handleGenerateContent = (config: any, label?: string) => {
        const generationLabel = label || customizationType;
        console.log('Generating with config:', config, 'for:', generationLabel);
        setPendingGeneration(generationLabel);
        setShowCustomization(false);
        setTimeout(() => setPendingGeneration(undefined), 100);
    };

    const handleCreateNotebook = () => {
        setShowUploadModal(true);
    };

    // Convert documents to source format for Sidebar
    const sourcesForSidebar = documents.map(doc => ({
        id: doc.id,
        title: doc.filename,
        chunks: doc.chunks,
        status: doc.status,
    }));

    // Check if we have sources
    const hasSources = documents.length > 0;
    const isUploading = uploadProgress.some(p => p.status === "uploading" || p.status === "processing");

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden text-gray-900 font-sans" ref={containerRef}>
            <Header
                title={isUploading ? "Uploading..." : notebookTitle}
                onCreateNotebook={handleCreateNotebook}
            />

            <main className="flex-1 flex overflow-hidden p-4 gap-4">
                {/* Sidebar Section */}
                <div
                    style={{ width: isSidebarCollapsed ? "48px" : `${sidebarWidth}px` }}
                    className="flex-shrink-0 flex items-stretch transition-all duration-75"
                >
                    <div className="flex-1 flex overflow-hidden">
                        <Sidebar
                            isCollapsed={isSidebarCollapsed}
                            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            sources={sourcesForSidebar}
                            isUploading={isUploading}
                            onAddSource={() => setShowUploadModal(true)}
                            uploadProgress={uploadProgress}
                            onDeleteSource={handleDeleteDocument}
                            onClearAll={handleClearAll}
                            stats={stats}
                        />
                    </div>
                    {!isSidebarCollapsed && <ResizeHandle onMouseDown={startResizingSidebar} className="ml-1" />}
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <WebSocketProvider>
                            <ChatPanel
                                hasSources={hasSources}
                                onUploadClick={() => setShowUploadModal(true)}
                                isUploading={isUploading}
                                messages={messages}
                                onSendMessage={handleQuery}
                                isQuerying={isQuerying}
                                stats={stats}
                                useWebSocket={true}
                            />
                        </WebSocketProvider>
                    </div>
                </div>

                {/* Studio Section */}
                <div
                    style={{ width: isStudioCollapsed ? "48px" : `${studioWidth}px` }}
                    className="flex-shrink-0 flex items-stretch transition-all duration-75"
                >
                    {!isStudioCollapsed && <ResizeHandle onMouseDown={startResizingStudio} className="mr-1" />}
                    <div className="flex-1 flex overflow-hidden">
                        <StudioPanel
                            isCollapsed={isStudioCollapsed}
                            onToggle={() => setIsStudioCollapsed(!isStudioCollapsed)}
                            onNoteClick={(viewName: string) => {
                                if (viewName === 'Architecture') setShowArchitecture(true);
                                if (viewName === 'Flashcards') setShowFlashcards(true);
                                if (viewName === 'Report') setShowReport(true);
                                if (viewName === 'Quiz') setShowQuiz(true);
                                if (viewName === 'Audio') setShowAudio(true);
                                if (viewName === 'Video') setShowVideo(true);
                                if (viewName === 'Infographic') setShowInfographic(true);
                                if (viewName === 'Slide Deck') setShowSlideDeck(true);
                            }}
                            onItemClick={handleItemClickFromStudio}
                            pendingGenerationLabel={pendingGeneration}
                            hasSources={hasSources}
                            data={dummyData}
                        />
                    </div>
                </div>
            </main>

            {/* Modals */}
            {showArchitecture && (
                <ArchitectureView onClose={() => setShowArchitecture(false)} />
            )}

            {showFlashcards && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowFlashcards(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <FlashcardsView isModal={true} />
                </div>
            )}

            {showReport && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowReport(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <ReportView isModal={true} />
                </div>
            )}

            {showQuiz && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowQuiz(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <QuizView isModal={true} />
                </div>
            )}

            {showAudio && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowAudio(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <AudioView isModal={true} />
                </div>
            )}

            {showVideo && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowVideo(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <VideoView isModal={true} />
                </div>
            )}

            {showInfographic && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowInfographic(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <InfographicView isModal={true} />
                </div>
            )}

            {showSlideDeck && (
                <div className="fixed inset-0 z-[300] bg-white animate-in zoom-in-95 duration-300">
                    <div className="absolute top-6 right-6 z-[310]">
                        <button onClick={() => setShowSlideDeck(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <Icons.Minimize2 size={24} />
                        </button>
                    </div>
                    <SlideDeckView isModal={true} />
                </div>
            )}

            {showCustomization && (
                <StudioCustomizationModal
                    type={customizationType}
                    onClose={() => setShowCustomization(false)}
                    onGenerate={handleGenerateContent}
                />
            )}

            {showUploadModal && (
                <UploadModal
                    onClose={() => setShowUploadModal(false)}
                    onUpload={handleFileUpload}
                    onTextUpload={handleTextUpload}
                />
            )}
        </div>
    );
}
