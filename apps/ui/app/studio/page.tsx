"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Sidebar from "@/components/studio/Sidebar";
import ChatPanel from "@/components/studio/ChatPanel";
import StudioPanel from "@/components/studio/StudioPanel";
import Header from "@/components/studio/Header";
import ResizeHandle from "@/components/studio/ResizeHandle";
import ArchitectureView from "@/components/studio/ArchitectureView";
import UploadModal from "@/components/studio/UploadModal";
import FlashcardsView from "@/components/studio/FlashcardsView";
import ReportView from "@/components/studio/ReportView";
import QuizView from "@/components/studio/QuizView";
import StudioCustomizationModal from "@/components/studio/StudioCustomizationModal";
import AudioView from "@/components/studio/AudioView";
import VideoView from "@/components/studio/VideoView";
import InfographicView from "@/components/studio/InfographicView";
import SlideDeckView from "@/components/studio/SlideDeckView";
import { WebSocketProvider, useWebSocketContext } from "@/lib/websocket";
import {
    listSessions,
    createSession,
    updateSessionTitle,
    uploadDocument,
    deleteDocument as deleteDocumentAPI,
    generateSessionId,
    Session as APISession,
    fetchDocuments,
} from "@/lib/api/sessions";

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

// Inner component that uses WebSocket context
function KnowledgePageContent({
    currentSessionId,
    onSessionChange,
}: {
    currentSessionId: string | null;
    onSessionChange: (id: string) => void;
}) {
    const wsContext = useWebSocketContext();
    const { isSignedIn, isLoaded, user } = useUser();
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

    // Session State (NotebookLM-style persistence)
    const [sessions, setSessions] = useState<APISession[]>([]);
    const [persistenceEnabled, setPersistenceEnabled] = useState(false);

    // Use session ID from props (managed by outer component)
    const setCurrentSessionId = onSessionChange;

    // RAG State
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const [stats, setStats] = useState<RAGStats | null>(null);
    const [notebookTitle, setNotebookTitle] = useState("Knowledge Base");

    const containerRef = useRef<HTMLDivElement>(null);

    // Redirect if not signed in
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/sign-in");
        }
    }, [isLoaded, isSignedIn, router]);

    // Load documents and session info for the current session
    useEffect(() => {
        const loadSessionData = async () => {
            if (!currentSessionId) return;

            try {
                // Fetch session details and persistence status
                const response = await listSessions();
                setSessions(response.sessions);
                setPersistenceEnabled(response.persistence_enabled);

                // Find current session to get title
                const currentSession = response.sessions.find(s => s.session_id === currentSessionId);
                if (currentSession?.title) {
                    setNotebookTitle(currentSession.title);
                }

                // Load documents for this session from the database
                const docs = await fetchDocuments(currentSessionId);
                if (docs.length > 0) {
                    setDocuments(docs.map(doc => ({
                        id: doc.document_id,
                        filename: doc.filename,
                        chunks: doc.chunks_count || 0,
                        uploadedAt: new Date(doc.created_at || Date.now()),
                        status: doc.status as "processing" | "ready" | "error",
                    })));
                    console.log(`Loaded ${docs.length} documents for session ${currentSessionId}`);
                }
            } catch (error) {
                console.error("Failed to load session data:", error);
            }
        };

        if (isLoaded && isSignedIn && currentSessionId) {
            loadSessionData();
        }
    }, [isLoaded, isSignedIn, currentSessionId]);

    // Fetch RAG stats on mount
    useEffect(() => {
        fetchStats();
    }, []);

    // Update notebook title based on first document
    useEffect(() => {
        if (documents.length > 0 && notebookTitle === "Knowledge Base") {
            const firstDoc = documents[0];
            const name = firstDoc.filename.replace(/\.[^/.]+$/, ""); // Remove extension
            setNotebookTitle(name);
            // Update title in database if we have a session
            if (currentSessionId && persistenceEnabled) {
                updateSessionTitle(currentSessionId, name).catch(console.error);
            }
        }
    }, [documents, notebookTitle, currentSessionId, persistenceEnabled]);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/stats`);
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    };

    // File upload handler - now includes session ID for persistence
    const handleFileUpload = async (files: File[]) => {
        // Ensure we have a session ID
        let sessionId = currentSessionId;
        if (!sessionId) {
            sessionId = generateSessionId();
            setCurrentSessionId(sessionId);
            try {
                await createSession("New Notebook", sessionId);
            } catch (e) {
                console.error("Failed to create session:", e);
            }
        }

        const newProgress: UploadProgress[] = files.map((f) => ({
            filename: f.name,
            progress: 0,
            status: "uploading" as const,
        }));
        setUploadProgress((prev) => [...prev, ...newProgress]);

        const uploadPromises = files.map(async (file) => {
            try {
                setUploadProgress((prev) =>
                    prev.map((p) =>
                        p.filename === file.name ? { ...p, progress: 50, status: "processing" as const } : p
                    )
                );

                // Use the API client which includes session_id
                const result = await uploadDocument(file, sessionId!);

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

                    // Generate and display document summary in chat via WebSocket context
                    try {
                        const summaryResponse = await fetch(`${RAG_API_URL}/api/rag/document-summary`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ document_id: result.document_id }),
                        });
                        const summaryResult = await summaryResponse.json();

                        if (summaryResult.success && summaryResult.summary) {
                            const summaryMessage = {
                                id: `summary-${result.document_id}`,
                                role: "assistant" as const,
                                content: `📄 **${file.name}** uploaded successfully!\n\n**Summary:** ${summaryResult.summary}\n\n_${result.chunks_created} chunks indexed. You can now ask questions about this document._`,
                                timestamp: new Date(),
                            };
                            // Add to WebSocket context so ChatPanel sees it
                            wsContext.addMessage(summaryMessage);
                        } else {
                            // Summary failed but upload succeeded - show basic message
                            const basicMessage = {
                                id: `upload-${result.document_id}`,
                                role: "assistant" as const,
                                content: `📄 **${file.name}** uploaded successfully! ${result.chunks_created} chunks indexed. You can now ask questions about this document.`,
                                timestamp: new Date(),
                            };
                            wsContext.addMessage(basicMessage);
                        }
                    } catch (summaryError) {
                        console.error("Failed to generate summary:", summaryError);
                        // Still show a basic success message
                        const basicMessage = {
                            id: `upload-${result.document_id}`,
                            role: "assistant" as const,
                            content: `📄 **${file.name}** uploaded successfully! ${result.chunks_created} chunks indexed. You can now ask questions about this document.`,
                            timestamp: new Date(),
                        };
                        wsContext.addMessage(basicMessage);
                    }
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

        // Ensure we have a session ID
        let sessionId = currentSessionId;
        if (!sessionId) {
            sessionId = generateSessionId();
            setCurrentSessionId(sessionId);
            try {
                await createSession("New Notebook", sessionId);
            } catch (e) {
                console.error("Failed to create session:", e);
            }
        }

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

            // Create a text blob and upload it
            const blob = new Blob([content], { type: 'text/plain' });
            const file = new File([blob], `${type}_content_${Date.now()}.txt`, { type: 'text/plain' });

            const result = await uploadDocument(file, sessionId!);

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

                // Generate and display content summary in chat via WebSocket context
                try {
                    const summaryResponse = await fetch(`${RAG_API_URL}/api/rag/document-summary`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ document_id: result.document_id }),
                    });
                    const summaryResult = await summaryResponse.json();

                    if (summaryResult.success && summaryResult.summary) {
                        const summaryMessage = {
                            id: `summary-${result.document_id}`,
                            role: "assistant" as const,
                            content: `📄 **${filename}** added successfully!\n\n**Summary:** ${summaryResult.summary}\n\n_${result.chunks_created} chunks indexed. You can now ask questions about this content._`,
                            timestamp: new Date(),
                        };
                        wsContext.addMessage(summaryMessage);
                    }
                } catch (summaryError) {
                    console.error("Failed to generate summary:", summaryError);
                    const basicMessage = {
                        id: `upload-${result.document_id}`,
                        role: "assistant" as const,
                        content: `📄 **${filename}** added successfully! ${result.chunks_created} chunks indexed. You can now ask questions about this content.`,
                        timestamp: new Date(),
                    };
                    wsContext.addMessage(basicMessage);
                }
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

    // RAG Query handler - uses WebSocket for smart handler processing
    const handleQuery = (query: string) => {
        if (!query.trim()) return;

        // Use WebSocket's sendMessage - it goes through smart handler
        // which auto-detects intent (general_chat vs knowledge_query)
        if (wsContext.isConnected && currentSessionId) {
            wsContext.sendMessage(query.trim(), currentSessionId);
        } else {
            console.warn("WebSocket not connected, cannot send query");
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

    // Clear session documents only
    const handleClearAll = async () => {
        if (!confirm("Are you sure you want to clear all documents from this session?")) {
            return;
        }

        try {
            await fetch(`${RAG_API_URL}/api/rag/clear`, { method: "DELETE" });
            setDocuments([]);
            setNotebookTitle("Knowledge Base");
            fetchStats();
        } catch (error) {
            console.error("Failed to clear knowledge base:", error);
        }
    };

    // Clear entire knowledge base (all ChromaDB data)
    const handleClearKnowledgeBase = async () => {
        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/clear`, { method: "DELETE" });
            if (!response.ok) {
                throw new Error("Failed to clear knowledge base");
            }
            // Clear local state as well
            setDocuments([]);
            setNotebookTitle("Knowledge Base");
            // Refresh sessions list
            const sessionsResponse = await listSessions();
            setSessions(sessionsResponse.sessions);
            fetchStats();
        } catch (error) {
            console.error("Failed to clear knowledge base:", error);
            throw error; // Re-throw so the UI can show error state
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
                            onClearKnowledgeBase={handleClearKnowledgeBase}
                            stats={stats}
                        />
                    </div>
                    {!isSidebarCollapsed && <ResizeHandle onMouseDown={startResizingSidebar} className="ml-1" />}
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <ChatPanel
                            hasSources={hasSources}
                            onUploadClick={() => setShowUploadModal(true)}
                            isUploading={isUploading}
                            stats={stats}
                        />
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
                            onMindMapNodeClick={(nodeLabel: string, nodeData: any) => {
                                // Send a contextual query to chat about the clicked node
                                const rootContext = nodeData?.rootLabel || 'the knowledge base';
                                const query = `Discuss what these sources say about ${nodeLabel}, in the larger context of ${rootContext}.`;
                                handleQuery(query);
                            }}
                        />
                    </div>
                </div>
            </main>

            {/* Modals */}
            {showArchitecture && (
                <ArchitectureView
                    onClose={() => setShowArchitecture(false)}
                    onNodeClick={(nodeId: string, nodeData: any) => {
                        // Send a contextual query to chat about the clicked node
                        const nodeLabel = nodeData?.label || nodeId;
                        const rootContext = nodeData?.rootLabel || 'the knowledge base';
                        const query = `Discuss what these sources say about ${nodeLabel}, in the larger context of ${rootContext}.`;
                        handleQuery(query);
                        setShowArchitecture(false); // Close modal after clicking
                    }}
                />
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
                <AudioView onClose={() => setShowAudio(false)} />
            )}

            {showVideo && (
                <VideoView onClose={() => setShowVideo(false)} />
            )}

            {showInfographic && (
                <InfographicView onClose={() => setShowInfographic(false)} />
            )}

            {showSlideDeck && (
                <SlideDeckView onClose={() => setShowSlideDeck(false)} />
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

// Main component that wraps everything with WebSocketProvider
export default function KnowledgePage() {
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const { isSignedIn, isLoaded } = useUser();
    const router = useRouter();

    // Initialize session from database or generate new one
    useEffect(() => {
        const initSession = async () => {
            if (!isLoaded || !isSignedIn) return;

            try {
                // Try to fetch existing sessions first
                const response = await listSessions();

                if (response.sessions.length > 0) {
                    // Use the most recent session
                    const latestSession = response.sessions[0];
                    setCurrentSessionId(latestSession.session_id);
                } else {
                    // No existing sessions - create a new one
                    const newSessionId = generateSessionId();
                    setCurrentSessionId(newSessionId);
                    await createSession("New Notebook", newSessionId);
                }
            } catch (error) {
                console.error("Failed to initialize session:", error);
                // Fallback: generate a local session ID
                const newSessionId = generateSessionId();
                setCurrentSessionId(newSessionId);
            }

            setIsInitialized(true);
        };

        initSession();
    }, [isLoaded, isSignedIn]);

    // Redirect if not signed in
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/sign-in");
        }
    }, [isLoaded, isSignedIn, router]);

    // Show loading until we have a session ID
    if (!currentSessionId || !isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    return (
        <WebSocketProvider sessionId={currentSessionId}>
            <KnowledgePageContent
                currentSessionId={currentSessionId}
                onSessionChange={setCurrentSessionId}
            />
        </WebSocketProvider>
    );
}
