import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ThumbsUp, ThumbsDown, RotateCw } from 'lucide-react';

interface Flashcard {
    id: number;
    question: string;
    answer: string;
}

interface FlashcardsViewProps {
    onClose?: () => void;
    onExpand?: () => void;
    isModal?: boolean;
}

const DUMMY_FLASHCARDS: Flashcard[] = [
    { id: 1, question: "What does the acronym jAI stand for?", answer: "jAI stands for 'just AI' or 'joint AI', representing the unified agent framework." },
    { id: 2, question: "What is the DNA framework in jAI?", answer: "The DNA framework is a structured architecture composed of 13 essential characteristics for enterprise AI deployment." },
    { id: 3, question: "What does A2A stand for?", answer: "A2A stands for Agent-to-Agent protocol, enabling multiple specialized bots to collaborate." }
];

const FlashcardsView: React.FC<FlashcardsViewProps> = ({ onClose, onExpand, isModal }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    const handleNext = () => {
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % DUMMY_FLASHCARDS.length);
    };

    const handlePrev = () => {
        setIsFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + DUMMY_FLASHCARDS.length) % DUMMY_FLASHCARDS.length);
    };

    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-8' : 'p-4'}`}>
            {/* Header / Breadcrumbs */}
            {!isModal && (
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                        <span className="cursor-pointer hover:text-gray-900 transition-colors">Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">App</span>
                    </div>
                    <button
                        onClick={onExpand}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Expand"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col items-center justify-center ${isModal ? 'max-w-4xl mx-auto w-full' : ''}`}>
                <h2 className={`${isModal ? 'text-3xl' : 'text-xl'} font-bold text-gray-900 mb-2 w-full text-left`}>
                    Architecture Flashcards
                </h2>
                <p className="text-sm text-gray-500 mb-8 w-full text-left font-medium">Based on 1 source</p>

                {/* Card Container */}
                <div className="relative w-full aspect-[4/3] max-h-[400px] perspective-1000 group">
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className={`relative w-full h-full transition-all duration-500 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                    >
                        {/* Front */}
                        <div className="absolute inset-0 bg-gray-900 text-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl overflow-hidden border border-white/10">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
                            <p className={`${isModal ? 'text-4xl' : 'text-2xl'} font-semibold leading-tight z-10`}>
                                {DUMMY_FLASHCARDS[currentIndex].question}
                            </p>
                            <div className="absolute bottom-8 text-gray-400 text-sm font-medium z-10 flex items-center gap-2">
                                <RotateCw size={14} />
                                See answer
                            </div>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 bg-blue-600 text-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center rotate-y-180 backface-hidden shadow-2xl border border-white/10">
                            <p className={`${isModal ? 'text-2xl' : 'text-xl'} font-medium leading-relaxed`}>
                                {DUMMY_FLASHCARDS[currentIndex].answer}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-center gap-8 mt-8 w-full">
                    <button
                        onClick={handlePrev}
                        className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-600"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <span className="text-sm font-bold text-gray-400 tracking-widest uppercase">
                        {currentIndex + 1} / {DUMMY_FLASHCARDS.length}
                    </span>
                    <button
                        onClick={handleNext}
                        className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-600"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {/* Footer Actions */}
            <div className={`flex items-center justify-center gap-4 mt-8 pt-4 border-t border-gray-100 ${isModal ? 'mb-8' : ''}`}>
                <button className="px-6 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                    <ThumbsUp size={18} />
                    Good content
                </button>
                <button className="px-6 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                    <ThumbsDown size={18} />
                    Bad content
                </button>
            </div>

            <style jsx>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
};

export default FlashcardsView;
