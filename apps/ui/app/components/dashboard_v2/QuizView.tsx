import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Maximize2, ChevronRight } from 'lucide-react';

interface QuizViewProps {
    onClose?: () => void;
    onExpand?: () => void;
    isModal?: boolean;
}

const QuizView: React.FC<QuizViewProps> = ({ onClose, onExpand, isModal }) => {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const questions = [
        {
            id: 1,
            text: "According to the jAI Agent DNA Blueprint, which characteristic layer includes capabilities like 'Tool Use', 'Actions', and 'Workflows'?",
            options: [
                { id: 'A', text: 'SAFETY LAYER' },
                { id: 'B', text: 'EXECUTION LAYER' },
                { id: 'C', text: 'IDENTITY LAYER' },
                { id: 'D', text: 'PLANNING LAYER' }
            ],
            correct: 'B'
        }
    ];

    const currentQuestion = questions[0];

    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-8' : 'p-4'}`}>
            {/* Header / Breadcrumbs */}
            {!isModal && (
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span className="cursor-pointer hover:text-gray-900 transition-colors">Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">App</span>
                    </div>
                    <button
                        onClick={onExpand}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col ${isModal ? 'max-w-3xl mx-auto w-full' : ''}`}>
                {/* Quiz Header */}
                <div className="mb-8">
                    <h1 className={`${isModal ? 'text-3xl' : 'text-xl'} font-bold text-gray-900 mb-1`}>Agent Quiz</h1>
                    <p className="text-[11px] text-gray-500 font-medium">Based on 1 source</p>
                </div>

                <div className="flex-1">
                    {/* Progress */}
                    <div className="text-gray-400 text-sm font-semibold mb-6">
                        1/10
                    </div>

                    {/* Question */}
                    <h2 className={`${isModal ? 'text-2xl' : 'text-base'} font-bold text-gray-800 leading-relaxed mb-8`}>
                        {currentQuestion.text}
                    </h2>

                    {/* Options */}
                    <div className="space-y-3">
                        {currentQuestion.options.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setSelectedOption(option.id)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-4 group ${selectedOption === option.id
                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className={`text-sm font-bold ${selectedOption === option.id ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {option.id}.
                                </span>
                                <span className={`text-sm font-semibold ${selectedOption === option.id ? 'text-blue-900' : 'text-gray-700'}`}>
                                    {option.text}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Next Button */}
                    <div className="mt-8">
                        <button
                            disabled={!selectedOption}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${selectedOption
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* Footer Feedback */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100 shrink-0">
                    <button className="px-6 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                        <ThumbsUp size={16} />
                        Good content
                    </button>
                    <button className="px-6 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                        <ThumbsDown size={16} />
                        Bad content
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuizView;
