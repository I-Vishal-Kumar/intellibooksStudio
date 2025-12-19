"use client";

import { useState, useRef, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Upload,
  Mic,
  FileAudio,
  Languages,
  Brain,
  FileText,
  Play,
  Pause,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  X,
  RefreshCw,
} from "lucide-react";

interface ProcessingResult {
  transcription?: string;
  translation?: string;
  summary?: string;
  intent?: {
    primary: string;
    confidence: number;
    sentiment: string;
  };
  keywords?: string[];
}

export default function AudioProcessingPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState({
    transcribe: true,
    translate: false,
    summarize: true,
    analyzeIntent: true,
    extractKeywords: true,
    targetLanguage: "es",
  });

  const audioRef = useRef<HTMLAudioElement>(null);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setAudioUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && droppedFile.type.startsWith("audio/")) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Simulate processing steps
      const steps = [];
      if (options.transcribe) steps.push("transcribe");
      if (options.translate) steps.push("translate");
      if (options.summarize) steps.push("summarize");
      if (options.analyzeIntent) steps.push("intent");
      if (options.extractKeywords) steps.push("keywords");

      const mockResult: ProcessingResult = {};

      for (const step of steps) {
        setCurrentStep(step);
        await new Promise((resolve) => setTimeout(resolve, 1500));

        switch (step) {
          case "transcribe":
            mockResult.transcription =
              "This is a sample transcription of the audio file. The speaker discusses important topics related to customer service and product feedback. They mention several key points about improving the user experience and addressing common concerns.";
            break;
          case "translate":
            mockResult.translation =
              "Esta es una transcripción de muestra del archivo de audio. El orador discute temas importantes relacionados con el servicio al cliente y los comentarios sobre el producto.";
            break;
          case "summarize":
            mockResult.summary =
              "Key Points:\n• Customer service improvements needed\n• Product feedback collected\n• User experience concerns addressed\n• Action items identified for follow-up";
            break;
          case "intent":
            mockResult.intent = {
              primary: "Feedback",
              confidence: 0.89,
              sentiment: "Neutral",
            };
            break;
          case "keywords":
            mockResult.keywords = [
              "customer service",
              "feedback",
              "user experience",
              "product",
              "improvements",
            ];
            break;
        }
      }

      setResult(mockResult);
      setCurrentStep(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setAudioUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const processingSteps = [
    { id: "transcribe", label: "Transcribe", icon: Mic, enabled: options.transcribe },
    { id: "translate", label: "Translate", icon: Languages, enabled: options.translate },
    { id: "summarize", label: "Summarize", icon: FileText, enabled: options.summarize },
    { id: "intent", label: "Intent", icon: Brain, enabled: options.analyzeIntent },
    { id: "keywords", label: "Keywords", icon: FileAudio, enabled: options.extractKeywords },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-lg font-bold text-white">j</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Audio Processing</h1>
                <p className="text-sm text-gray-500">Transcribe, translate, summarize & analyze</p>
              </div>
            </div>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Upload & Options */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Audio</h2>

              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50/50 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="font-medium text-gray-700">Drag & drop audio file</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                  <p className="text-xs text-gray-400 mt-2">MP3, WAV, FLAC, M4A (max 100MB)</p>
                </div>
              ) : (
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                      <FileAudio className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={togglePlay}
                      className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-gray-700" />
                      ) : (
                        <Play className="w-5 h-5 text-gray-700" />
                      )}
                    </button>
                    <button
                      onClick={clearFile}
                      className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  {audioUrl && (
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Processing Options */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Options</h2>
              <div className="space-y-3">
                {[
                  { key: "transcribe", label: "Transcription", desc: "Convert speech to text", icon: Mic },
                  { key: "translate", label: "Translation", desc: "Translate to another language", icon: Languages },
                  { key: "summarize", label: "Summarization", desc: "Extract key points", icon: FileText },
                  { key: "analyzeIntent", label: "Intent Analysis", desc: "Detect intent & sentiment", icon: Brain },
                  { key: "extractKeywords", label: "Keyword Extraction", desc: "Find important terms", icon: FileAudio },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = options[opt.key as keyof typeof options] as boolean;
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                        isChecked ? "bg-green-50 border border-green-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setOptions({ ...options, [opt.key]: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isChecked ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{opt.label}</p>
                        <p className="text-sm text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}

                {options.translate && (
                  <div className="pl-14 pt-2">
                    <label className="text-sm text-gray-600">Target Language</label>
                    <select
                      value={options.targetLanguage}
                      onChange={(e) => setOptions({ ...options, targetLanguage: e.target.value })}
                      className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                      <option value="hi">Hindi</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Process Button */}
              <button
                onClick={handleProcess}
                disabled={!file || isProcessing}
                className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-medium rounded-2xl transition-all shadow-lg shadow-green-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    Process Audio
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Processing Status */}
            {isProcessing && (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing</h2>
                <div className="flex items-center gap-4">
                  {processingSteps
                    .filter((s) => s.enabled)
                    .map((step, index) => {
                      const Icon = step.icon;
                      const isActive = currentStep === step.id;
                      const isCompleted =
                        processingSteps.findIndex((s) => s.id === currentStep) >
                        processingSteps.findIndex((s) => s.id === step.id);

                      return (
                        <div key={step.id} className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isCompleted
                                ? "bg-green-500 text-white"
                                : isActive
                                ? "bg-blue-500 text-white animate-pulse"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isActive ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Icon className="w-5 h-5" />
                            )}
                          </div>
                          {index < processingSteps.filter((s) => s.enabled).length - 1 && (
                            <div
                              className={`w-8 h-0.5 ${
                                isCompleted ? "bg-green-500" : "bg-gray-200"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 rounded-3xl border border-red-200 p-6">
                <div className="flex items-center gap-3 text-red-600">
                  <AlertCircle className="w-6 h-6" />
                  <p className="font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {result.transcription && (
                  <ResultCard
                    title="Transcription"
                    icon={<Mic className="w-5 h-5" />}
                    content={result.transcription}
                  />
                )}
                {result.translation && (
                  <ResultCard
                    title="Translation"
                    icon={<Languages className="w-5 h-5" />}
                    content={result.translation}
                  />
                )}
                {result.summary && (
                  <ResultCard
                    title="Summary"
                    icon={<FileText className="w-5 h-5" />}
                    content={result.summary}
                  />
                )}
                {result.intent && (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white">
                        <Brain className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Intent Analysis</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm text-gray-500">Primary Intent</p>
                        <p className="font-semibold text-gray-900">{result.intent.primary}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm text-gray-500">Confidence</p>
                        <p className="font-semibold text-gray-900">
                          {(result.intent.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-sm text-gray-500">Sentiment</p>
                        <p className="font-semibold text-gray-900">{result.intent.sentiment}</p>
                      </div>
                    </div>
                  </div>
                )}
                {result.keywords && (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Keywords</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!isProcessing && !result && !error && (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-12 shadow-xl shadow-gray-900/5 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileAudio className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Results Yet</h3>
                <p className="text-gray-500">
                  Upload an audio file and click Process to see the results here.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ResultCard({
  title,
  icon,
  content,
}: {
  title: string;
  icon: React.ReactNode;
  content: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white">
            {icon}
          </div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Download className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      <p className="text-gray-700 whitespace-pre-line">{content}</p>
    </div>
  );
}
