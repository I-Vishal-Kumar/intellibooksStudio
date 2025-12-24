"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
    listSessions,
    getSession,
    createSession,
    updateSessionTitle,
    deleteSession as deleteSessionAPI,
    uploadDocument,
    deleteDocument,
    generateSessionId,
    Session as APISession,
} from "@/lib/api/sessions";
import ShareModal from "@/components/dashboard_v2/ShareModal";
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
    const { isSignedIn, isLoaded, user } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatIdParam = searchParams.get("chatId");

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
    const [showShareModal, setShowShareModal] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string>("owner");

    // Fetch user role when conversation changes
    useEffect(() => {
        const fetchRole = async () => {
            if (!currentConversationId || !user?.id) return;
            try {
                const res = await fetch(`http://localhost:8004/api/conversations/${currentConversationId}/collaborators`, {
                    headers: { "X-User-Id": user.id }
                });
                if (res.ok) {
                    const collabs = await res.json();
                    const me = collabs.find((c: any) => c.user_id === user.id);
                    if (me) {
                        setUserRole(me.role);
                    } else {
                        // If not a collaborator, check if I'm the owner
                        // (Owner is not always in the collaborator list)
                        // Actually, my get_user_role utility handles this on backend.
                        // I should probably have a dedicated "GET /me/role" endpoint.
                        // For now, let's assume if I'm not in collab list, I'm the owner if it's my chat.
                        setUserRole("owner");
                    }
                }
            } catch (err) {
                console.error("Failed to fetch role:", err);
            }
        };
        fetchRole();
    }, [currentConversationId, user?.id]);

    // Handle chatId param from URL (e.g. from notifications)
    useEffect(() => {
        if (!chatIdParam || !user?.id) return;

        const loadConversation = async () => {
            try {
                const res = await fetch(`http://localhost:8004/api/conversations/${chatIdParam}`, {
                    headers: { "X-User-Id": user.id }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCurrentConversationId(data.id);
                    setNotebookTitle(data.title || "Untitled Chat");
                    // Transform messages to frontend format
                    const formattedMsgs = data.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        timestamp: new Date(m.created_at)
                    }));
                    setMessages(formattedMsgs);
                    if (data.document_ids && data.document_ids.length > 0) {
                        const loadedDocs = data.document_ids.map((id: string) => ({
                            id,
                            filename: "Shared Document",
                            status: "ready" as const,
                            uploadedAt: new Date()
                        }));
                        setDocuments(loadedDocs);
                    }
                }
            } catch (err) {
                console.error("Failed to load conversation from URL:", err);
            }
        };
        loadConversation();
    }, [chatIdParam, user?.id]);

    // Customization Modal
    const [showCustomization, setShowCustomization] = useState(false);
    const [customizationType, setCustomizationType] = useState('');
    const [pendingGeneration, setPendingGeneration] = useState<string | undefined>(undefined);

    // Session State (NotebookLM-style)
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<APISession[]>([]);
    const [persistenceEnabled, setPersistenceEnabled] = useState(false);

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

    // Fetch sessions and initialize current session on mount
    useEffect(() => {
        const initializeSession = async () => {
            try {
                // Fetch all sessions
                const response = await listSessions();
                setSessions(response.sessions);
                setPersistenceEnabled(response.persistence_enabled);

                // Check for session ID in URL
                const urlSessionId = searchParams.get("session");

                if (urlSessionId) {
                    // Load session from URL
                    await loadSession(urlSessionId);
                } else if (response.sessions.length > 0) {
                    // Load most recent session
                    await loadSession(response.sessions[0].session_id);
                } else {
                    // Create new session
                    const newSession = await createSession("New Notebook");
                    setCurrentSessionId(newSession.session_id);
                    setNotebookTitle(newSession.title || "New Notebook");
                    setSessions([newSession as APISession]);
                }
            } catch (error) {
                console.error("Failed to initialize sessions:", error);
                // Fallback: generate a local session ID
                const localSessionId = generateSessionId();
                setCurrentSessionId(localSessionId);
            }
        };

        initializeSession();
        fetchStats();
    }, [searchParams]);

    // Load a session and its data
    const loadSession = async (sessionId: string) => {
        try {
            const session = await getSession(sessionId, true);
            setCurrentSessionId(sessionId);
            setNotebookTitle(session.title || "Untitled Notebook");

            // Load documents from session
            if (session.documents) {
                setDocuments(session.documents.map(doc => ({
                    id: doc.document_id,
                    filename: doc.filename,
                    chunks: doc.chunks_count,
                    uploadedAt: doc.created_at ? new Date(doc.created_at) : new Date(),
                    status: doc.status as "processing" | "ready" | "error",
                })));
            }

            // Load messages from session
            if (session.messages) {
                setMessages(session.messages.map(msg => ({
                    id: msg.message_id,
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                    timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
                    sources: msg.sources,
                })));
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            // Create new session if load fails
            const newSession = await createSession("New Notebook");
            setCurrentSessionId(newSession.session_id);
            setNotebookTitle(newSession.title || "New Notebook");
        }
    };

    // Update notebook title based on first document (only if "Untitled")
    useEffect(() => {
        if (documents.length > 0 && notebookTitle === "Untitled Notebook") {
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

    // Text/URL upload handler - now includes session ID
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

            // Create a text blob and upload with session ID
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

        // Save to backend if conversation exists
        if (currentConversationId) {
            fetch(`http://localhost:8004/api/conversations/${currentConversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": user?.id || "anonymous"
                },
                body: JSON.stringify({ role: "user", content: query.trim() })
            }).catch(e => console.error("Failed to save user message:", e));
        }

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

            // Save to backend if conversation exists
            if (currentConversationId) {
                fetch(`http://localhost:8004/api/conversations/${currentConversationId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-User-Id": user?.id || "anonymous"
                    },
                    body: JSON.stringify({ role: "assistant", content: result.answer })
                }).catch(e => console.error("Failed to save assistant message:", e));
            }
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

    const handleShareClick = async () => {
        console.log("Share button clicked. Message count:", messages.length);
        if (messages.length === 0) {
            alert("No messages to share yet!");
            return;
        }

        // If we don't have a conversation ID yet, create one in the database
        if (!currentConversationId) {
            console.log("Saving conversation to backend before sharing...");
            try {
                const res = await fetch("http://localhost:8004/api/conversations/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: notebookTitle,
                        user_id: user?.id || "anonymous",
                        document_ids: documents.map(d => d.id)
                    })
                });
                const data = await res.json();
                const newId = data.id;
                console.log("Conversation created with ID:", newId);
                setCurrentConversationId(newId);
                setUserRole("owner");

                // Save all previous messages to this new conversation
                for (const msg of messages) {
                    await fetch(`http://localhost:8004/api/conversations/${newId}/messages`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-User-Id": user?.id || "anonymous"
                        },
                        body: JSON.stringify({ role: msg.role, content: msg.content })
                    });
                }
            } catch (err) {
                console.error("Failed to create conversation for sharing:", err);
            }
        }
        console.log("Opening Share Modal...");
        setShowShareModal(true);
    };

    // Delete document
    const handleDeleteDocument = async (documentId: string) => {
        try {
            await deleteDocument(documentId);
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
            // Delete each document in the current session
            for (const doc of documents) {
                await deleteDocument(doc.id);
            }
            setDocuments([]);
            setMessages([]);
            setNotebookTitle("Untitled Notebook");
            fetchStats();
        } catch (error) {
            console.error("Failed to clear session documents:", error);
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
            setMessages([]);
            setNotebookTitle("Untitled Notebook");
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
                onShare={handleShareClick}
                currentUserId={user?.id || "anonymous"}
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
                        <WebSocketProvider sessionId={currentSessionId} userId={user?.id}>
                            <ChatPanel
                                hasSources={hasSources}
                                onUploadClick={() => setShowUploadModal(true)}
                                isUploading={isUploading}
                                messages={messages}
                                onSendMessage={handleQuery}
                                onShareClick={handleShareClick}
                                isQuerying={isQuerying}
                                stats={stats}
                                readOnly={userRole === "viewer"}
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

            {showShareModal && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    conversationId={currentConversationId || undefined}
                    currentUserId={user?.id || "anonymous"}
                />
            )}
        </div>
    );
}
