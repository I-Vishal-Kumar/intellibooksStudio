import React, { useState } from 'react';
import { X, Check, ChevronDown, Sparkles } from 'lucide-react';

interface CustomizationModalProps {
    type: string;
    onClose: () => void;
    onGenerate: (config: any) => void;
}

const StudioCustomizationModal: React.FC<CustomizationModalProps> = ({ type, onClose, onGenerate }) => {
    const [config, setConfig] = useState<any>({
        format: 'Deep Dive',
        language: 'English',
        length: 'Default',
        difficulty: 'Medium (Default)',
        count: 'Standard (Default)',
        orientation: 'Landscape',
        detail: 'Standard',
        topic: ''
    });

    const isAudio = type === 'Audio Overview';
    const isFlashcards = type === 'Flashcards';
    const isQuiz = type === 'Quiz';
    const isInfographic = type === 'Infographic';
    const isSlideDeck = type === 'Slide Deck';
    const isVideo = type === 'Video Overview';

    const handleGenerate = () => {
        onGenerate(config);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <Sparkles size={20} className="text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Customize {type}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
                    {/* Audio Overview Specific */}
                    {isAudio && (
                        <>
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-gray-700">Format</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {['Deep Dive', 'Brief', 'Critique', 'Debate'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setConfig({ ...config, format: f })}
                                            className={`p-4 rounded-2xl border text-left transition-all ${config.format === f ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/10' : 'border-gray-100 hover:border-gray-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-gray-900">{f}</span>
                                                {config.format === f && <Check size={14} className="text-blue-600" />}
                                            </div>
                                            <p className="text-[10px] text-gray-500 leading-tight">
                                                {f === 'Deep Dive' && 'A lively conversation between two hosts.'}
                                                {f === 'Brief' && 'A bite-sized overview to grasp core ideas.'}
                                                {f === 'Critique' && 'An expert review offering feedback.'}
                                                {f === 'Debate' && 'Different perspectives on your sources.'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Choose language</label>
                                    <div className="relative group">
                                        <select
                                            value={config.language}
                                            onChange={(e) => setConfig({ ...config, language: e.target.value })}
                                            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 transition-all pr-10"
                                        >
                                            <option>English</option>
                                            <option>Spanish</option>
                                            <option>French</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Length</label>
                                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        {['Short', 'Default', 'Long'].map((l) => (
                                            <button
                                                key={l}
                                                onClick={() => setConfig({ ...config, length: l })}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${config.length === l ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Flashcards & Quiz Specific */}
                    {(isFlashcards || isQuiz) && (
                        <>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Number of Cards</label>
                                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        {['Fewer', 'Standard (Default)', 'More'].map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setConfig({ ...config, count: c })}
                                                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${config.count === c ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {c.split(' (')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Level of Difficulty</label>
                                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        {['Easy', 'Medium (Default)', 'Hard'].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setConfig({ ...config, difficulty: d })}
                                                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${config.difficulty === d ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {d.split(' (')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Infographic, Slide Deck & Video Specific */}
                    {(isInfographic || isSlideDeck || isVideo) && (
                        <>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Orientation</label>
                                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100 font-bold">
                                        {['Landscape', 'Portrait', 'Square'].map((o) => (
                                            <button
                                                key={o}
                                                onClick={() => setConfig({ ...config, orientation: o })}
                                                className={`flex-1 py-2 text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 ${config.orientation === o ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {config.orientation === o && <Check size={10} />}
                                                {o}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Level of detail</label>
                                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100 font-bold">
                                        {['Concise', 'Standard', 'Detailed'].map((d) => (
                                            <button
                                                key={d}
                                                onClick={() => setConfig({ ...config, detail: d })}
                                                className={`flex-1 py-2 text-[10px] rounded-lg transition-all flex items-center justify-center gap-1.5 ${config.detail === d ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {config.detail === d && <Check size={10} />}
                                                {d}
                                                {d === 'Detailed' && <span className="bg-gray-100 text-[8px] px-1 rounded ml-1">BETA</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Common Text Area */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700">
                            {isAudio || isVideo ? 'What should the AI hosts focus on in this episode?' :
                                isFlashcards || isQuiz ? 'What should the topic be?' :
                                    `Describe the ${type.toLowerCase()} you want to create`}
                        </label>
                        <textarea
                            value={config.topic}
                            onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                            placeholder={isFlashcards || isQuiz ? "Things to try\n• The flashcards must be restricted to a specific source\n• The flashcards must focus on a specific topic" : "Guide the style, color, or focus..."}
                            className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-none text-gray-600"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 flex items-center justify-end border-t border-gray-100">
                    <button
                        onClick={handleGenerate}
                        className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudioCustomizationModal;
