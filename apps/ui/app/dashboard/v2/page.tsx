"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import dummyData from "../../../dummy_data/dummy_data.json";

export default function DashboardV2() {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
    const [showArchitecture, setShowArchitecture] = useState(false);
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [hasNotebook, setHasNotebook] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Modal Views
    const [showAudio, setShowAudio] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [showInfographic, setShowInfographic] = useState(false);
    const [showSlideDeck, setShowSlideDeck] = useState(false);

    // Customization Modal
    const [showCustomization, setShowCustomization] = useState(false);
    const [customizationType, setCustomizationType] = useState('');
    const [pendingGeneration, setPendingGeneration] = useState<string | undefined>(undefined);

    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [studioWidth, setStudioWidth] = useState(384);

    const containerRef = useRef<HTMLDivElement>(null);

    const handleCreateNotebook = () => {
        setShowUploadModal(true);
    };

    const handleUploadComplete = () => {
        setIsUploading(true);
        setHasNotebook(false);

        setTimeout(() => {
            setIsUploading(false);
            setHasNotebook(true);
        }, 3000);
    };

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
        const startWidth = studioWidth;

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
    }, [studioWidth]);

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
        // Clear it immediately after passing to trigger the effect in child
        setTimeout(() => setPendingGeneration(undefined), 100);
    };

    return (
        <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden text-gray-900 font-sans" ref={containerRef}>
            <Header
                title={isUploading ? "Uploading..." : hasNotebook ? "jAI Agent Framework for Enterprise AI Deployment" : "Untitled Notebook"}
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
                            sources={hasNotebook ? dummyData.sources : []}
                            isUploading={isUploading}
                            onAddSource={() => setShowUploadModal(true)}
                        />
                    </div>
                    {!isSidebarCollapsed && <ResizeHandle onMouseDown={startResizingSidebar} className="ml-1" />}
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <ChatPanel
                            hasSources={hasNotebook}
                            onUploadClick={() => setShowUploadModal(true)}
                            isUploading={isUploading}
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
                            hasSources={hasNotebook}
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
                    onUpload={handleUploadComplete}
                />
            )}
        </div>
    );
}
