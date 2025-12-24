import React from 'react';
import { Download, Share2, Maximize2, MoreVertical, Layout, BarChart2, PieChart, Activity } from 'lucide-react';

interface InfographicViewProps {
    onExpand?: () => void;
    isModal?: boolean;
}

const InfographicView: React.FC<InfographicViewProps> = ({ onExpand, isModal }) => {
    return (
        <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isModal ? 'p-12' : 'p-6'}`}>
            {!isModal && (
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span>Studio</span>
                        <span>&gt;</span>
                        <span className="text-gray-900">Infographic</span>
                    </div>
                    <button onClick={onExpand} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <Maximize2 size={16} />
                    </button>
                </div>
            )}

            <div className={`flex-1 flex flex-col ${isModal ? 'max-w-4xl mx-auto w-full' : ''}`}>
                {/* Infographic Content */}
                <div className="bg-gray-50 rounded-[40px] border border-gray-100 p-8 shadow-inner overflow-y-auto max-h-full">
                    <div className="max-w-3xl mx-auto space-y-12">
                        {/* Header Section */}
                        <div className="text-center space-y-4">
                            <span className="bg-blue-600 text-[10px] text-white px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                                Report Summary 2024
                            </span>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Enterprise AI Impact Analysis</h2>
                            <p className="text-gray-500 font-medium max-w-lg mx-auto leading-relaxed">
                                A comprehensive visualization of performance metrics and adoption rates across the jAI Agent Framework.
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl mb-2">
                                    <Activity size={24} />
                                </div>
                                <span className="text-2xl font-black text-gray-900">84%</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Efficiency Gain</span>
                            </div>
                            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl mb-2">
                                    <PieChart size={24} />
                                </div>
                                <span className="text-2xl font-black text-gray-900">12x</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ROI Multiplier</span>
                            </div>
                            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mb-2">
                                    <BarChart2 size={24} />
                                </div>
                                <span className="text-2xl font-black text-gray-900">0.4s</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latency Reduction</span>
                            </div>
                        </div>

                        {/* Visual Breakdown */}
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Layout size={18} className="text-blue-600" />
                                    Departmental Adoption
                                </h3>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                                    <div className="w-2 h-2 rounded-full bg-blue-200" />
                                    <div className="w-2 h-2 rounded-full bg-blue-100" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                {[
                                    { label: 'Cloud Infrastructure', value: 'w-[90%]', color: 'bg-blue-600' },
                                    { label: 'Customer Experience', value: 'w-[75%]', color: 'bg-indigo-500' },
                                    { label: 'Risk & Compliance', value: 'w-[60%]', color: 'bg-violet-500' },
                                    { label: 'R&D Operations', value: 'w-[45%]', color: 'bg-rose-500' }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-gray-700">
                                            <span>{item.label}</span>
                                            <span>{item.value.match(/\d+/)?.[0] || '0'}%</span>
                                        </div>
                                        <div className="h-4 w-full bg-gray-50 rounded-full overflow-hidden p-1 border border-gray-100">
                                            <div className={`h-full ${item.value} ${item.color} rounded-full transition-all duration-1000`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center pt-8">
                            <button className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-sm shadow-xl shadow-blue-600/20 hover:scale-105 transition-all flex items-center gap-2 mx-auto">
                                <Download size={18} />
                                Download Full Report
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-8 hidden">
                    <div className="flex gap-3">
                        <button className="p-2 border border-blue-500/20 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                            <Share2 size={20} />
                        </button>
                        <button className="p-2 border border-gray-100 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-colors">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfographicView;
