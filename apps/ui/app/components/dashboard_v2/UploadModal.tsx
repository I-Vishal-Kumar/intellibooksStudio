import React, { useState } from 'react';
import { X, Upload, Globe, FileText, Layout, Cloud, Copy, ArrowLeft } from 'lucide-react';

interface UploadModalProps {
    onClose: () => void;
    onUpload: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload }) => {
    const [mode, setMode] = useState<'initial' | 'website' | 'youtube' | 'text'>('initial');
    const [inputValue, setInputValue] = useState('');
    const [isInternalUploading, setIsInternalUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const startSimulatedUpload = () => {
        setIsInternalUploading(true);
        setUploadProgress(0);

        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    onUpload();
                    onClose();
                    return 100;
                }
                return prev + 5;
            });
        }, 100);
    };

    const handleInsert = () => {
        if (inputValue.trim()) {
            startSimulatedUpload();
        }
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
                            {mode === 'initial' ? 'NotebookLM' :
                                mode === 'youtube' ? 'YouTube' :
                                    mode === 'website' ? 'Website' : 'Copied text'}
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
                                (Examples: marketing plans, course reading, research notes, meeting transcripts, sales documents, etc.)
                            </p>

                            <div
                                onClick={startSimulatedUpload}
                                className="border-2 border-dashed border-gray-200 rounded-[28px] p-12 flex flex-col items-center justify-center gap-4 bg-gray-50/50 hover:bg-gray-100/50 hover:border-blue-400 cursor-pointer transition-all group relative overflow-hidden"
                            >
                                {isInternalUploading ? (
                                    <div className="flex flex-col items-center gap-4 w-full px-12">
                                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 animate-pulse">
                                            <Upload size={32} />
                                        </div>
                                        <div className="w-full space-y-2">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                <span>Uploading...</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-600 transition-all duration-100"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                            <Upload size={32} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-xl font-semibold text-gray-900">Upload sources</h3>
                                            <p className="text-gray-500 mt-1 font-medium">
                                                Drag & drop or <span className="text-blue-600 hover:underline">choose file</span> to upload
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <p className="text-[10px] text-gray-400 text-center font-medium">
                                Supported file types: PDF, .txt, Markdown, Audio (e.g. mp3), .docx, .avif, .bmp, .gif, .ico, .jp2, .png, .webp, .tif, .tiff, .heic, .heif, .jpeg, .jpg, .jpe
                            </p>

                            <div className="grid grid-cols-3 gap-6 pt-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        <Cloud size={16} />
                                        Google Workspace
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
                                        <Copy size={18} className="text-blue-500" />
                                        Copied text
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    {mode === 'youtube' ? 'YouTube URL' : mode === 'website' ? 'Website URL' : 'Paste content'}
                                </label>
                                {mode === 'text' ? (
                                    <textarea
                                        autoFocus
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Paste your content here..."
                                        className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all font-medium text-gray-700 resize-none"
                                    />
                                ) : (
                                    <input
                                        autoFocus
                                        type="url"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={mode === 'youtube' ? "https://www.youtube.com/watch?v=..." : "https://example.com"}
                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all font-medium text-gray-700"
                                    />
                                )}
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleInsert}
                                    disabled={!inputValue.trim()}
                                    className="px-8 py-2.5 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    Insert
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400 font-medium">NotebookLM can be inaccurate; please double check its responses.</p>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
