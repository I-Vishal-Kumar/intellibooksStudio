import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Download, Share2, Maximize2, Layers } from 'lucide-react';

interface SlideDeckViewProps {
    onExpand?: () => void;
    isModal?: boolean;
}

const SlideDeckView: React.FC<SlideDeckViewProps> = ({ onExpand, isModal }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const totalSlides = 6;

    const slides = [
        { title: "Project jAI: The Future of Agents", content: "Leveraging decentralized protocols for scalable enterprise intelligence." },
        { title: "Core Characteristics", content: "A deep dive into the 13 foundational pillars of our framework." },
        { title: "A2A Protocol (Agent-to-Agent)", content: "Seamless communication between autonomous systems." },
        { title: "Security & Sovereignty", content: "On-premises deployment and cryptographically secured identities." },
        { title: "Adoption Roadmap", content: "Phased integration strategy for top-tier banking sectors." },
        { title: "Q&A & Next Steps", content: "Opening the floor for discussion and implementation planning." }
    ];

    return (
        <div className={`flex flex-col h-full bg-[#f8fafc] transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {!isModal && (
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span>Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">Slide Deck</span>
                    </div>
                    <button onClick={onExpand} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col ${isModal ? 'max-w-5xl mx-auto w-full' : ''}`}>
                {/* Presentation Area */}
                <div className="flex gap-8 h-full min-h-0">
                    {/* Main Slide */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="aspect-video w-full bg-white rounded-[40px] shadow-2xl shadow-blue-900/10 border border-gray-100 p-16 flex flex-col transition-all relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 text-[8px] font-black text-blue-100 uppercase tracking-widest group-hover:text-blue-200 transition-colors">
                                Slide {currentSlide + 1} / {totalSlides}
                            </div>

                            <div className="mt-auto space-y-6 max-w-2xl">
                                <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">
                                    {slides[currentSlide].title}
                                </h2>
                                <p className="text-xl text-gray-500 font-medium leading-relaxed">
                                    {slides[currentSlide].content}
                                </p>
                            </div>

                            <div className="mt-12 flex gap-4">
                                <div className="w-12 h-1 bg-blue-600 rounded-full" />
                                <div className="w-12 h-1 bg-gray-100 rounded-full" />
                                <div className="w-12 h-1 bg-gray-100 rounded-full" />
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between bg-white px-8 py-4 rounded-full shadow-lg shadow-blue-900/5 border border-gray-100/50">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                                    className="p-2 text-gray-400 hover:bg-gray-50 rounded-full transition-all disabled:opacity-20"
                                    disabled={currentSlide === 0}
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <span className="text-sm font-bold text-gray-900 w-16 text-center">
                                    {currentSlide + 1} / {totalSlides}
                                </span>
                                <button
                                    onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))}
                                    className="p-2 text-gray-400 hover:bg-gray-50 rounded-full transition-all disabled:opacity-20"
                                    disabled={currentSlide === totalSlides - 1}
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                    <Layers size={20} />
                                </button>
                                <div className="h-6 w-px bg-gray-200" />
                                <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-blue-600/20">
                                    <Play size={16} fill="currentColor" />
                                    Present
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sorter Sidebar (Modal only) */}
                    {isModal && (
                        <div className="w-48 flex flex-col gap-4 overflow-y-auto pr-4 scrollbar-hide">
                            {slides.map((slide, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentSlide(i)}
                                    className={`aspect-video w-full rounded-2xl border-2 transition-all p-3 text-left overflow-hidden shrink-0 ${currentSlide === i ? 'border-blue-600 bg-white ring-4 ring-blue-600/5 shadow-xl shadow-blue-900/10' : 'border-transparent hover:border-blue-200'
                                        }`}
                                >
                                    <p className="text-[6px] font-black text-gray-900 truncate mb-1">{slide.title}</p>
                                    <div className="h-px w-4 bg-blue-600 mb-1" />
                                    <div className="h-0.5 w-full bg-gray-100 rounded-full mb-0.5" />
                                    <div className="h-0.5 w-full bg-gray-100 rounded-full mb-0.5" />
                                    <div className="h-0.5 w-2/3 bg-gray-100 rounded-full" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SlideDeckView;
