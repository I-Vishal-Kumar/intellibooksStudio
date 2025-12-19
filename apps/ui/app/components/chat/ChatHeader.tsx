"use client";

import { Share2, Copy, Check, MoreVertical } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/chat/utils";

interface ChatHeaderProps {
  title?: string;
  onShare?: () => void;
  sharedId?: string;
  isShared?: boolean;
}

export function ChatHeader({
  title = "New Chat",
  onShare,
  sharedId,
  isShared = false,
}: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (sharedId) {
      const url = `${window.location.origin}/chat/${sharedId}`;
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
          {isShared && (
            <p className="text-xs text-gray-500 mt-0.5">Shared conversation</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {sharedId && (
            <button
              onClick={handleCopyLink}
              className={cn(
                "p-2 rounded-lg transition-colors",
                copied
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title={copied ? "Copied!" : "Copy link"}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}

          {onShare && !isShared && (
            <button
              onClick={onShare}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="Share conversation"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          <button
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

