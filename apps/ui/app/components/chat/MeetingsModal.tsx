"use client";

import { useState, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { useLiveRecording } from "@/lib/useLiveRecording";
import {
  X,
  Mic,
  Square,
  Clock,
  Users,
  FileText,
  Sparkles,
  Calendar,
  Play,
  Pause,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  summary: string;
  duration: number; // in seconds
  participants: number;
  timestamp: Date;
  transcript: string;
}

interface MeetingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MeetingsModal({ isOpen, onClose }: MeetingsModalProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");

  // Live recording hook with chunking
  const {
    isRecording,
    duration,
    chunkCount,
    chunksProcessed,
    chunksPending,
    liveTranscript: recordingTranscript,
    error,
    sessionId,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  } = useLiveRecording({
    chunkDuration: 10, // 10 seconds per chunk
    onTranscriptUpdate: (transcript) => {
      setLiveTranscript(transcript);
    },
    onSessionStart: (sessionId) => {
      console.log("Recording session started:", sessionId);
    },
    onSessionStop: async () => {
      // Handle meeting completion
      await handleMeetingComplete();
    },
    onError: (error) => {
      console.error("Recording error:", error);
    },
  });

  const handleStartRecording = () => {
    startRecording();
  };

  const handleStopRecording = async () => {
    await stopRecording();
  };

  const handleCancelRecording = () => {
    cancelRecording();
    setLiveTranscript("");
  };

  const handleMeetingComplete = async () => {
    // TODO: Fetch final meeting data from backend
    // For now, create a placeholder meeting
    const newMeeting: Meeting = {
      id: sessionId || `meeting-${Date.now()}`,
      title: "New Meeting",
      summary: liveTranscript.substring(0, 100) + (liveTranscript.length > 100 ? "..." : ""),
      duration,
      participants: 1,
      timestamp: new Date(),
      transcript: liveTranscript,
    };
    setMeetings((prev) => [newMeeting, ...prev]);
    setLiveTranscript("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Meetings</h2>
              <p className="text-sm text-gray-500">Record and manage your meetings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Live Recording Section */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-red-50 to-orange-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Live Recording</h3>
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-700">Recording</span>
                </div>
              )}
            </div>

            {!isRecording ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleStartRecording}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
                <p className="text-sm text-gray-600">
                  Click to start recording your meeting. The recording will continue until you stop it.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Duration and Progress */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Duration</span>
                      <span className="text-lg font-mono font-semibold text-gray-900">
                        {formatDuration(duration)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((duration / 3600) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Chunks</span>
                      <span className="text-lg font-mono font-semibold text-gray-900">
                        {chunksProcessed}/{chunkCount}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${chunkCount > 0 ? (chunksProcessed / chunkCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    {chunksPending > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {chunksPending} chunk{chunksPending !== 1 ? "s" : ""} pending
                      </p>
                    )}
                  </div>
                </div>

                {/* Live Transcript */}
                {liveTranscript && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-gray-700">Live Transcript</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{liveTranscript}</p>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleStopRecording}
                    disabled={chunksPending > 0}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:transform-none"
                  >
                      <Square className="w-5 h-5" />
                      <span>Stop Recording</span>
                  </button>
                  <button
                    onClick={handleCancelRecording}
                    disabled={chunksPending > 0}
                    className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-red-300 hover:border-red-400 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 font-medium rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Meetings List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Past Meetings</h3>
              <span className="text-sm text-gray-500">{meetings.length} meetings</span>
            </div>

            {meetings.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h4>
                <p className="text-sm text-gray-500">
                  Start recording a meeting to see it here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MeetingCardProps {
  meeting: Meeting;
}

function MeetingCard({ meeting }: MeetingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="text-base font-semibold text-gray-900">{meeting.title}</h4>
            {meeting.summary.includes("processing") && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                Processing
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{meeting.summary}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatMeetingDuration(meeting.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{meeting.participants} participant{meeting.participants !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{DateTime.fromJSDate(meeting.timestamp).toRelative()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <X className="w-4 h-4 text-gray-500" />
            ) : (
              <MoreVertical className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              <Play className="w-4 h-4" />
              Play
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Download
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors ml-auto">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
          {meeting.transcript && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Transcript</h5>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{meeting.transcript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function for formatting duration (in seconds)
function formatMeetingDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

