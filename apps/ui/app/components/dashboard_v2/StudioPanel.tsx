import { FC, useState, useEffect } from "react";
import * as Icons from "lucide-react";
import FlashcardsView from "./FlashcardsView";
import ArchitectureView from "./ArchitectureView";
import ReportView from "./ReportView";
import QuizView from "./QuizView";
import {
    PanelRightClose,
    PanelRight,
    Pencil,
    Volume2,
    Video,
    Map,
    FileText,
    Layout,
    HelpCircle,
    FileBarChart,
    Presentation,
    MoreVertical,
    Play,
    Radio,
    Check,
    RotateCw,
    Maximize2
} from "lucide-react";

interface StudioPanelProps {
    isCollapsed: boolean;
    onToggle: () => void;
    onNoteClick?: (viewName: string) => void;
    onItemClick?: (label: string) => void;
    pendingGenerationLabel?: string;
    hasSources: boolean;
    data: any;
    onMindMapNodeClick?: (nodeLabel: string, nodeData: any) => void;
}

const IconMapper = ({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) => {
    const IconComponent = (Icons as any)[name];
    if (!IconComponent) return null;
    return <IconComponent size={size} className={className} />;
};

const StudioPanel: FC<StudioPanelProps> = ({ isCollapsed, onToggle, onNoteClick, onItemClick, pendingGenerationLabel, hasSources, data: initialData, onMindMapNodeClick }) => {
    const [currentView, setCurrentView] = useState<'grid' | 'flashcards' | 'architecture' | 'report' | 'quiz'>('grid');
    const [generatingItems, setGeneratingItems] = useState<string[]>([]);
    const [notes, setNotes] = useState(initialData.notes);

    useEffect(() => {
        if (pendingGenerationLabel) {
            startGeneration(pendingGenerationLabel);
        }
    }, [pendingGenerationLabel]);

    const handleItemClick = (item: any) => {
        if (!hasSources) return;

        // For Mind Map, directly show the view without generation delay
        // It auto-generates from RAG data
        if (item.label === 'Mind Map') {
            setCurrentView('architecture');
            return;
        }

        onItemClick?.(item.label);
    };

    // This would be called by the parent after customization
    const startGeneration = (label: string) => {
        if (generatingItems.includes(label)) return;
        setGeneratingItems([...generatingItems, label]);

        setTimeout(() => {
            setGeneratingItems(prev => prev.filter(i => i !== label));

            const lowerLabel = label.toLowerCase();
            let viewType = 'architecture';
            if (lowerLabel.includes('flashcard')) viewType = 'flashcards';
            else if (lowerLabel.includes('report')) viewType = 'report';
            else if (lowerLabel.includes('quiz')) viewType = 'quiz';
            else if (lowerLabel.includes('audio')) viewType = 'audio';
            else if (lowerLabel.includes('video')) viewType = 'video';
            else if (lowerLabel.includes('infographic')) viewType = 'infographic';
            else if (lowerLabel.includes('slide deck')) viewType = 'slide_deck';

            const newNote = {
                id: Date.now().toString(),
                icon: initialData.studioItems.find((i: any) => i.label === label)?.icon || 'FileText',
                title: label === 'Report' ? 'jAI Agent Framework Briefing' : `${label} Output`,
                subtitle: "1 source · just now",
                color: initialData.studioItems.find((i: any) => i.label === label)?.color || 'text-blue-500',
                clickable: true,
                viewType: viewType
            };
            setNotes([newNote, ...notes]);
        }, 10000);
    };

    const handleNoteClick = (note: any) => {
        if (note.viewType === 'flashcards') setCurrentView('flashcards');
        else if (note.viewType === 'architecture') setCurrentView('architecture');
        else if (note.viewType === 'report') setCurrentView('report');
        else if (note.viewType === 'quiz') setCurrentView('quiz');
        else if (note.viewType === 'audio') onNoteClick?.('Audio');
        else if (note.viewType === 'video') onNoteClick?.('Video');
        else if (note.viewType === 'infographic') onNoteClick?.('Infographic');
        else if (note.viewType === 'slide_deck') onNoteClick?.('Slide Deck');
    };

    if (isCollapsed) {
        return (
            <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4 gap-4 transition-all duration-300 shrink-0">
                <button onClick={onToggle} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                    <PanelRight size={20} />
                </button>
            </div>
        );
    }

    if (currentView !== 'grid') {
        return (
            <div className="w-full h-full bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                    <span className="font-semibold text-gray-700 truncate mr-2">Studio</span>
                    <button onClick={onToggle} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                        <PanelRightClose size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {currentView === 'flashcards' && <FlashcardsView onExpand={() => onNoteClick?.('Flashcards')} />}
                    {currentView === 'architecture' && (
                        <ArchitectureView
                            isModal={false}
                            onExpand={() => onNoteClick?.('Architecture')}
                            onNodeClick={(nodeId, nodeData) => {
                                if (onMindMapNodeClick && nodeData?.label) {
                                    onMindMapNodeClick(nodeData.label, nodeData);
                                }
                            }}
                        />
                    )}
                    {currentView === 'report' && <ReportView isModal={false} onExpand={() => onNoteClick?.('Report')} />}
                    {currentView === 'quiz' && <QuizView isModal={false} onExpand={() => onNoteClick?.('Quiz')} />}
                </div>
                <div
                    onClick={() => setCurrentView('grid')}
                    className="p-4 flex justify-center sticky bottom-0 bg-white border-t border-gray-50 flex-none z-10"
                >
                    <button className="bg-white border border-gray-200 text-gray-700 px-6 py-2 rounded-full font-medium flex items-center gap-2 shadow-sm hover:bg-gray-50 transition-all truncate max-w-full">
                        <Icons.ArrowLeft size={18} className="shrink-0" />
                        <span className="truncate">Back to Studio</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white border border-gray-200 rounded-2xl flex flex-col transition-all duration-300 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                <span className="font-semibold text-gray-700 truncate mr-2">Studio</span>
                <button onClick={onToggle} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                    <PanelRightClose size={18} />
                </button>
            </div>

            <div className={`flex-1 overflow-y-auto p-3 space-y-3 min-h-0 overflow-x-hidden transition-all duration-500 ${!hasSources ? 'opacity-60 grayscale scale-[0.98]' : 'opacity-100 grayscale-0 scale-100'}`}>
                {/* Language Overview Banner */}
                <div className="bg-[#f0fdf4] border border-[#dcfce7] p-3 rounded-xl shrink-0">
                    <p className="text-xs text-[#166534] leading-relaxed break-words">
                        Create an <span className="font-semibold whitespace-nowrap">Audio Overview</span> in:
                        <span className="whitespace-normal">
                            {initialData.languages.map((lang: string, i: number) => (
                                <span key={lang} className="text-blue-600 cursor-pointer hover:underline ml-1">
                                    {lang}{i < initialData.languages.length - 1 ? "," : ""}
                                </span>
                            ))}
                        </span>
                    </p>
                </div>

                {/* Grid Area */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                    {initialData.studioItems.map((item: any) => (
                        <StudioItem
                            key={item.id}
                            icon={<IconMapper name={item.icon} className={item.color} />}
                            label={item.label}
                            bgColor={item.bgColor}
                            isBeta={item.isBeta}
                            onClick={() => handleItemClick(item)}
                        />
                    ))}
                </div>

                {/* Notes/Feed items */}
                <div className="mt-4 space-y-3 min-h-0">
                    {hasSources ? (
                        <>
                            {generatingItems.map((itemLabel) => (
                                <GeneratingItem key={itemLabel} label={itemLabel} />
                            ))}
                            {notes.map((note: any) => (
                                <NoteItem
                                    key={note.id}
                                    icon={<IconMapper name={note.icon} className={note.color} />}
                                    title={note.title}
                                    subtitle={note.subtitle}
                                    onClick={() => handleNoteClick(note)}
                                />
                            ))}
                        </>
                    ) : (
                        notes.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 opacity-50">
                                <Icons.Zap size={32} className="text-gray-400" />
                                <p className="text-[11px] text-gray-500 font-medium px-4">
                                    Studio output will be saved here.<br />
                                    After adding sources, click to add Audio Overview, Guide, Mind Map, and more!
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Bottom Add Note Button */}
            <div className="p-4 flex justify-center sticky bottom-0 bg-white border-t border-gray-50 flex-none z-10">
                <button className="bg-black text-white px-6 py-2 rounded-full font-medium flex items-center gap-2 shadow-lg hover:bg-gray-800 transition-all truncate max-w-full">
                    <FileText size={18} className="shrink-0" />
                    <span className="truncate">Add note</span>
                </button>
            </div>
        </div>
    );
};

const GeneratingItem: FC<{ label: string }> = ({ label }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-transparent animate-pulse">
        <div className="p-2.5 bg-white rounded-full border border-gray-100 shadow-sm shrink-0">
            <RotateCw size={18} className="text-blue-500 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-gray-800 truncate">Generating {label}...</h4>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate">Come back in a few minutes</p>
        </div>
    </div>
);

const StudioItem: FC<{ icon: React.ReactNode; label: string; bgColor: string; isBeta?: boolean; onClick?: () => void }> = ({ icon, label, bgColor, isBeta, onClick }) => {
    const hasPencil = !['Mind Map', 'Reports'].includes(label);

    return (
        <button
            onClick={onClick}
            className={`p-1 rounded-lg border border-gray-100 flex flex-col gap-1 group transition-all hover:shadow-md hover:border-gray-200 ${bgColor} min-w-0 text-left relative overflow-hidden h-16`}
        >
            <div className="flex justify-between items-start w-full gap-1">
                <div className="p-1 bg-white rounded-md shadow-sm border border-gray-50 flex items-center justify-center shrink-0 w-6 h-6">
                    {icon}
                </div>
                {hasPencil && (
                    <div className="p-0.5 bg-gray-100/50 rounded-md group-hover:bg-white transition-colors shrink-0 border border-transparent group-hover:border-gray-100">
                        <Pencil size={8} className="text-gray-500" />
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden">
                {isBeta && (
                    <span className="bg-[#000000] text-[6px] text-white px-0.5 py-0.5 rounded font-bold uppercase tracking-widest shrink-0">
                        BETA
                    </span>
                )}
                <span className="text-[10px] font-semibold text-gray-700 truncate leading-tight">{label}</span>
            </div>
        </button>
    );
};

const NoteItem: FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick?: () => void }> = ({ icon, title, subtitle, onClick }) => {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="relative group min-w-0">
            <div
                className="flex items-center gap-3 py-2 px-1 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group min-w-0 border-b border-gray-50 last:border-0"
                onClick={onClick}
            >
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-gray-800 truncate leading-tight">{title}</h4>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5 truncate uppercase tracking-tight">{subtitle}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 px-2.5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors shrink-0">
                        <Play size={10} fill="currentColor" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-900 transition-colors shrink-0"
                    >
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-2xl py-2 w-48 z-[70] animate-in slide-in-from-top-2 duration-200">
                        {[
                            { label: 'Rename', icon: Pencil },
                            { label: 'Download', icon: Icons.Download },
                            { label: 'Share', icon: Icons.Share2 },
                            { label: 'Delete', icon: Icons.Trash2, color: 'text-rose-500' }
                        ].map((item: any, i) => (
                            <button
                                key={i}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold hover:bg-gray-50 transition-colors ${item.color || 'text-gray-700'}`}
                            >
                                <item.icon size={14} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default StudioPanel;
