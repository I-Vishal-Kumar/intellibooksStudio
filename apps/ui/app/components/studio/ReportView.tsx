import React from 'react';
import { Pencil, Copy, Trash2, ThumbsUp, ThumbsDown, Maximize2 } from 'lucide-react';

interface ReportViewProps {
    onClose?: () => void;
    onExpand?: () => void;
    isModal?: boolean;
}

const ReportView: React.FC<ReportViewProps> = ({ onClose, onExpand, isModal }) => {
    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-8' : 'p-4'}`}>
            {/* Header / Breadcrumbs */}
            {!isModal && (
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span className="cursor-pointer hover:text-gray-900 transition-colors">Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">Report</span>
                    </div>
                    <button
                        onClick={onExpand}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col ${isModal ? 'max-w-4xl mx-auto w-full' : ''}`}>
                {/* Report Header */}
                <div className="flex items-start justify-between mb-6 group">
                    <div className="space-y-1">
                        <h1 className={`${isModal ? 'text-3xl' : 'text-lg'} font-bold text-gray-900 leading-tight`}>
                            jAI Agent Framework: A Comprehensive Briefing
                        </h1>
                        <p className="text-[11px] text-gray-500 font-medium">Based on 1 source</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil size={18} />
                        </button>
                        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <Copy size={18} />
                        </button>
                        <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className={`flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar ${isModal ? 'text-lg' : 'text-sm'}`}>
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-gray-900">jAI Agent Framework: A Comprehensive Briefing</h2>
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800">Executive Summary</h3>
                            <p className="text-gray-600 leading-relaxed font-medium">
                                The jAI (Jai Infoway Artificial Intelligence Platform) framework outlines a comprehensive architecture for creating powerful, intelligent, and trustworthy enterprise AI agents. Built upon a DNA of 13 core characteristics, jAI agents are designed to deliver a quantum leap in performance for complex business processes, particularly in the insurance and banking sectors. The framework's key differentiators include true agentic AI capabilities, sophisticated multi-agent collaboration, and deep reasoning over enterprise knowledge graphs.
                            </p>
                            <p className="text-gray-600 leading-relaxed font-medium">
                                This briefing document explores the core pillars of the jAI framework, detailing how it addresses the challenges of scalability, security, and interpretability in large-scale AI deployments.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4 pb-8">
                        <h3 className="font-bold text-gray-800">The 13 Core Characteristics</h3>
                        <p className="text-gray-600 leading-relaxed font-medium">
                            At the heart of the jAI framework lie 13 essential characteristics that define the behavior and capabilities of an enterprise agent. These include:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-gray-600 font-medium">
                            <li><strong>Cryptographic Identity:</strong> Ensuring every agent has a verifiable and secure identity.</li>
                            <li><strong>Multi-stage Reasoning:</strong> The ability to break down complex problems into manageable steps.</li>
                            <li><strong>Tool Integration:</strong> Seamlessly interacting with existing enterprise systems and APIs.</li>
                        </ul>
                    </section>
                </div>

                {/* Footer Feedback */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100 shrink-0">
                    <button className="px-6 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                        <ThumbsUp size={16} />
                        Good report
                    </button>
                    <button className="px-6 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                        <ThumbsDown size={16} />
                        Bad report
                    </button>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
};

export default ReportView;
