"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TASKS = [
  { id: "transcribe", label: "Transcription", description: "Convert speech to text" },
  { id: "translate", label: "Translation", description: "Translate to other languages" },
  { id: "summarize", label: "Summarization", description: "Generate key points" },
  { id: "detect_intent", label: "Intent Detection", description: "Analyze purpose & sentiment" },
  { id: "extract_keywords", label: "Keywords", description: "Extract important terms" },
];

const LANGUAGES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
];

const SUMMARY_TYPES = [
  { id: "general", label: "General Summary" },
  { id: "key_points", label: "Key Points" },
  { id: "action_items", label: "Action Items" },
  { id: "quick", label: "Quick Summary" },
];

export function ProcessingOptions() {
  const [selectedTasks, setSelectedTasks] = useState<string[]>(["transcribe"]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [summaryType, setSummaryType] = useState("general");
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((t) => t !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleLanguage = (code: string) => {
    setTargetLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/v1/agents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: selectedTasks,
          options: {
            targetLanguages,
            summaryType,
          },
        }),
      });
      // Handle response
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Task Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Processing Tasks
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                selectedTasks.includes(task.id)
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center",
                  selectedTasks.includes(task.id)
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100"
                )}
              >
                {selectedTasks.includes(task.id) && (
                  <Check className="w-3 h-3" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{task.label}</p>
                <p className="text-xs text-gray-500">{task.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Translation Languages */}
      {selectedTasks.includes("translate") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Languages
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-all",
                  targetLanguages.includes(lang.code)
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Type */}
      {selectedTasks.includes("summarize") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Summary Type
          </label>
          <select
            value={summaryType}
            onChange={(e) => setSummaryType(e.target.value)}
            className="input"
          >
            {SUMMARY_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Process Button */}
      <button
        onClick={handleProcess}
        disabled={selectedTasks.length === 0 || isProcessing}
        className="w-full btn-primary py-3 disabled:opacity-50"
      >
        {isProcessing ? "Processing..." : "Start Processing"}
      </button>
    </div>
  );
}
