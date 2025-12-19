"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingResult {
  transcription?: {
    text: string;
    language: string;
    confidence?: number;
  };
  summary?: {
    summaryText: string;
    keyPoints: string[];
    actionItems?: string[];
  };
  intent?: {
    primaryIntent: string;
    confidence: number;
    sentiment: string;
    urgency: string;
    reasoning: string;
  };
  keywords?: Array<{
    keyword: string;
    keywordType: string;
    relevanceScore: number;
  }>;
  translations?: Array<{
    targetLanguage: string;
    translatedText: string;
  }>;
}

interface ResultsPanelProps {
  result: ProcessingResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "transcription",
  ]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Transcription */}
      {result.transcription && (
        <ResultSection
          title="Transcription"
          section="transcription"
          isExpanded={expandedSections.includes("transcription")}
          onToggle={() => toggleSection("transcription")}
          onCopy={() =>
            copyToClipboard(result.transcription!.text, "transcription")
          }
          isCopied={copiedSection === "transcription"}
        >
          <div className="space-y-2">
            <div className="flex gap-2 text-xs text-gray-500">
              <span>Language: {result.transcription.language.toUpperCase()}</span>
              {result.transcription.confidence && (
                <span>
                  Confidence: {(result.transcription.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">
              {result.transcription.text}
            </p>
          </div>
        </ResultSection>
      )}

      {/* Summary */}
      {result.summary && (
        <ResultSection
          title="Summary"
          section="summary"
          isExpanded={expandedSections.includes("summary")}
          onToggle={() => toggleSection("summary")}
          onCopy={() =>
            copyToClipboard(result.summary!.summaryText, "summary")
          }
          isCopied={copiedSection === "summary"}
        >
          <div className="space-y-4">
            <p className="text-gray-700">{result.summary.summaryText}</p>

            {result.summary.keyPoints.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">
                  Key Points
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  {result.summary.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm text-gray-600">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.summary.actionItems && result.summary.actionItems.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">
                  Action Items
                </h4>
                <ul className="space-y-1">
                  {result.summary.actionItems.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ResultSection>
      )}

      {/* Intent */}
      {result.intent && (
        <ResultSection
          title="Intent Analysis"
          section="intent"
          isExpanded={expandedSections.includes("intent")}
          onToggle={() => toggleSection("intent")}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500">Primary Intent</span>
              <p className="font-medium capitalize">{result.intent.primaryIntent}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Confidence</span>
              <p className="font-medium">
                {(result.intent.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Sentiment</span>
              <p className={cn(
                "font-medium capitalize",
                result.intent.sentiment === "positive" && "text-green-600",
                result.intent.sentiment === "negative" && "text-red-600",
                result.intent.sentiment === "neutral" && "text-gray-600"
              )}>
                {result.intent.sentiment}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Urgency</span>
              <p className={cn(
                "font-medium capitalize",
                result.intent.urgency === "high" && "text-red-600",
                result.intent.urgency === "medium" && "text-yellow-600",
                result.intent.urgency === "low" && "text-green-600"
              )}>
                {result.intent.urgency}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-gray-500">Reasoning</span>
            <p className="text-sm text-gray-700">{result.intent.reasoning}</p>
          </div>
        </ResultSection>
      )}

      {/* Keywords */}
      {result.keywords && result.keywords.length > 0 && (
        <ResultSection
          title="Keywords"
          section="keywords"
          isExpanded={expandedSections.includes("keywords")}
          onToggle={() => toggleSection("keywords")}
        >
          <div className="flex flex-wrap gap-2">
            {result.keywords.map((kw, i) => (
              <span
                key={i}
                className={cn(
                  "px-2 py-1 rounded-full text-sm",
                  kw.keywordType === "entity"
                    ? "bg-purple-100 text-purple-700"
                    : kw.keywordType === "keyphrase"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
                )}
              >
                {kw.keyword}
                <span className="ml-1 text-xs opacity-60">
                  {(kw.relevanceScore * 100).toFixed(0)}%
                </span>
              </span>
            ))}
          </div>
        </ResultSection>
      )}

      {/* Translations */}
      {result.translations && result.translations.length > 0 && (
        <ResultSection
          title="Translations"
          section="translations"
          isExpanded={expandedSections.includes("translations")}
          onToggle={() => toggleSection("translations")}
        >
          <div className="space-y-3">
            {result.translations.map((trans, i) => (
              <div key={i} className="border-l-2 border-primary-200 pl-3">
                <span className="text-xs font-medium text-primary-600 uppercase">
                  {trans.targetLanguage}
                </span>
                <p className="text-sm text-gray-700 mt-1">
                  {trans.translatedText}
                </p>
              </div>
            ))}
          </div>
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  title,
  section,
  isExpanded,
  onToggle,
  onCopy,
  isCopied,
  children,
}: {
  title: string;
  section: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy?: () => void;
  isCopied?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <div className="flex items-center gap-2">
          {onCopy && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>
      {isExpanded && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}
