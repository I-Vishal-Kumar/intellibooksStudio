"use client";

import { useState, KeyboardEvent } from "react";
import { Send, Mic, MicOff, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  isLoading = false,
  placeholder = "Type a message...",
  disabled = false,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = () => {
    if (!input.trim() || isLoading || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <button
          onClick={toggleRecording}
          disabled={disabled}
          className={cn(
            "p-2.5 rounded-lg transition-all flex-shrink-0",
            isRecording
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        <button
          className="p-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled}
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading || disabled}
            rows={1}
            className={cn(
              "w-full px-4 py-3 pr-12 rounded-xl border border-gray-300",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "resize-none overflow-hidden",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-sm"
            )}
            style={{
              minHeight: "48px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || disabled}
          className={cn(
            "p-2.5 rounded-lg transition-all flex-shrink-0",
            "bg-gradient-to-br from-blue-600 to-blue-700 text-white",
            "hover:from-blue-700 hover:to-blue-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-sm hover:shadow-md"
          )}
          title="Send message"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}

