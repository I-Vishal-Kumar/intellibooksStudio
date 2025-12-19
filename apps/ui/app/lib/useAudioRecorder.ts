"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  isTranscribing: boolean;
  duration: number;
  audioBlob: Blob | null;
  transcribedText: string;
  error: string | null;
  speechRecognitionAvailable: boolean;
}

interface UseAudioRecorderOptions {
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: string) => void;
  useBrowserSpeechRecognition?: boolean;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const {
    onTranscriptionComplete,
    onError,
    useBrowserSpeechRecognition = true,
  } = options;

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    isTranscribing: false,
    duration: 0,
    audioBlob: null,
    transcribedText: "",
    error: null,
    speechRecognitionAvailable: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimTranscriptRef = useRef<string>("");

  // Initialize browser speech recognition
  useEffect(() => {
    if (useBrowserSpeechRecognition && typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            interimTranscriptRef.current += finalTranscript;
            setState((prev) => ({
              ...prev,
              transcribedText: interimTranscriptRef.current.trim(),
            }));
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          // Handle specific errors gracefully
          if (event.error === "network") {
            // Network error - speech recognition service unavailable
            // This is common when offline or behind certain firewalls
            // Don't show error, just continue recording without live transcription
            console.log("Speech recognition network error - continuing without live transcription");
            setState((prev) => ({
              ...prev,
              error: null, // Clear error to not alarm user
            }));
          } else if (event.error === "not-allowed") {
            setState((prev) => ({
              ...prev,
              error: "Microphone access denied. Please allow microphone access.",
            }));
            onError?.("Microphone access denied");
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            setState((prev) => ({
              ...prev,
              error: `Speech recognition: ${event.error}`,
            }));
            onError?.(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          // Restart if still recording
          if (state.isRecording && !state.isPaused) {
            try {
              recognition.start();
            } catch {
              // Already started or stopped
            }
          }
        };

        recognitionRef.current = recognition;
        setState((prev) => ({ ...prev, speechRecognitionAvailable: true }));
      } else {
        setState((prev) => ({ ...prev, speechRecognitionAvailable: false }));
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped
        }
      }
    };
  }, [useBrowserSpeechRecognition, onError, state.isRecording, state.isPaused]);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      audioChunksRef.current = [];
      interimTranscriptRef.current = "";

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        transcribedText: "",
        error: null,
      }));

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        setState((prev) => ({ ...prev, audioBlob }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      // Start timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start speech recognition if available
      if (recognitionRef.current && useBrowserSpeechRecognition) {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      setState((prev) => ({ ...prev, error: errorMessage, isRecording: false }));
      onError?.(errorMessage);
    }
  }, [useBrowserSpeechRecognition, onError]);

  const stopRecording = useCallback(async () => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setState((prev) => ({ ...prev, isRecording: false, isPaused: false }));

    // Call completion callback with transcribed text
    const transcribedText = interimTranscriptRef.current.trim();
    if (transcribedText) {
      onTranscriptionComplete?.(transcribedText);
    }

    return transcribedText;
  }, [onTranscriptionComplete]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped
        }
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started
        }
      }
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
    }

    // Stop media recorder without saving
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Reset state
    audioChunksRef.current = [];
    interimTranscriptRef.current = "";

    setState((prev) => ({
      isRecording: false,
      isPaused: false,
      isTranscribing: false,
      duration: 0,
      audioBlob: null,
      transcribedText: "",
      error: null,
      speechRecognitionAvailable: prev.speechRecognitionAvailable,
    }));
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Already stopped
        }
      }
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    formatDuration,
  };
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
