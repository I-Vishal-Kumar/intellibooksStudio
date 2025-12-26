import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Globe, FileText, Layout, Cloud, Copy, ArrowLeft, FileUp } from 'lucide-react';

interface UploadModalProps {
    onClose: () => void;
    onUpload: (files: File[]) => void;
    onTextUpload?: (content: string, type: 'text' | 'website' | 'youtube') => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, onTextUpload }) => {
    const [mode, setMode] = useState<'initial' | 'website' | 'youtube' | 'text'>('initial');
    const [inputValue, setInputValue] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            onUpload(files);
            onClose();
        }
    }, [onUpload, onClose]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            onUpload(files);
            onClose();
        }
    };

    const handleInsert = () => {
        if (inputValue.trim() && onTextUpload) {
            onTextUpload(inputValue.trim(), mode as 'text' | 'website' | 'youtube');
            onClose();
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-[800px] bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <div className="flex items-center gap-2">
                        {mode !== 'initial' && (
                            <button
                                onClick={() => setMode('initial')}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors mr-2"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div className="p-1 px-2 border border-black rounded-lg">
                            <span className="font-bold text-lg">j</span>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900">
                            {mode === 'initial' ? 'Knowledge Base' :
                                mode === 'youtube' ? 'YouTube' :
                                    mode === 'website' ? 'Website' : 'Paste Text'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    {mode === 'initial' ? (
                        <>
                            <p className="text-gray-500 font-medium">
                                Upload documents to build your knowledge base. Ask questions and get AI-powered answers.
                            </p>

                            {/* Upload Area */}
                            <div
                                onClick={handleUploadClick}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-[28px] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group relative overflow-hidden ${
                                    dragActive
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 hover:border-purple-400'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.docx,.doc,.txt,.md,.html,.json,.csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform ${
                                    dragActive ? 'bg-purple-100 text-purple-600 scale-110' : 'bg-purple-50 text-purple-500 group-hover:scale-110'
                                }`}>
                                    {dragActive ? <FileUp size={32} /> : <Upload size={32} />}
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-semibold text-gray-900">
                                        {dragActive ? 'Drop files to upload' : 'Upload sources'}
                                    </h3>
                                    <p className="text-gray-500 mt-1 font-medium">
                                        {dragActive ? 'Release to upload your files' : (
                                            <>Drag & drop or <span className="text-purple-600 hover:underline">choose file</span> to upload</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <p className="text-[10px] text-gray-400 text-center font-medium">
                                Supported file types: PDF, .txt, Markdown, .docx, .html, .json, .csv
                            </p>

                            <div className="grid grid-cols-3 gap-6 pt-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        <Cloud size={16} />
                                        Cloud Storage
                                    </div>
                                    <button className="w-full flex items-center gap-3 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-gray-700">
                                        <div className="w-6 h-6 flex items-center justify-center">
                                            <Cloud size={18} className="text-blue-500" />
                                        </div>
                                        Google Drive
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        <Globe size={16} />
                                        Link
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setMode('website')}
                                            className="flex-1 flex items-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-gray-700 truncate"
                                        >
                                            <Layout size={18} className="text-blue-500 shrink-0" />
                                            Website
                                        </button>
                                        <button
                                            onClick={() => setMode('youtube')}
                                            className="flex-1 flex items-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-gray-700 truncate"
                                        >
                                            <Globe size={18} className="text-rose-500 shrink-0" />
                                            YouTube
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        <FileText size={16} />
                                        Paste text
                                    </div>
                                    <button
                                        onClick={() => setMode('text')}
                                        className="w-full flex items-center gap-3 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-gray-700"
                                    >
                                        <Copy size={18} className="text-purple-500" />
                                        Paste content
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    {mode === 'youtube' ? 'YouTube URL' : mode === 'website' ? 'Website URL' : 'Paste your content'}
                                </label>
                                {mode === 'text' ? (
                                    <textarea
                                        autoFocus
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Paste your content here... This will be indexed and searchable in your knowledge base."
                                        className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all font-medium text-gray-700 resize-none"
                                    />
                                ) : (
                                    <input
                                        autoFocus
                                        type="url"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={mode === 'youtube' ? "https://www.youtube.com/watch?v=..." : "https://example.com"}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all font-medium text-gray-700"
                                    />
                                )}
                                {mode !== 'text' && (
                                    <p className="text-xs text-gray-400 mt-2">
                                        {mode === 'youtube'
                                            ? 'The video transcript will be extracted and indexed.'
                                            : 'The webpage content will be scraped and indexed.'
                                        }
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleInsert}
                                    disabled={!inputValue.trim()}
                                    className="px-8 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                                >
                                    Add to Knowledge Base
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400 font-medium">
                        Documents are processed locally and indexed for semantic search.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
