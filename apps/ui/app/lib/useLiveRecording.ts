"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";

export interface LiveRecordingState {
  isRecording: boolean;
  duration: number;
  chunkCount: number;
  chunksProcessed: number;
  chunksPending: number;
  liveTranscript: string;
  error: string | null;
  sessionId: string | null;
}

interface UseLiveRecordingOptions {
  chunkDuration?: number; // Duration in seconds for each chunk (default: 10)
  onTranscriptUpdate?: (transcript: string) => void;
  onError?: (error: string) => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionStop?: () => void;
}

export function useLiveRecording(options: UseLiveRecordingOptions = {}) {
  const {
    chunkDuration = 10, // 10 seconds per chunk
    onTranscriptUpdate,
    onError,
    onSessionStart,
    onSessionStop,
  } = options;

  const [state, setState] = useState<LiveRecordingState>({
    isRecording: false,
    duration: 0,
    chunkCount: 0,
    chunksProcessed: 0,
    chunksPending: 0,
    liveTranscript: "",
    error: null,
    sessionId: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const chunkIndexRef = useRef<number>(0);
  const chunkQueueRef = useRef<Array<{ blob: Blob; index: number }>>([]);
  const isUploadingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const bufferSize = 4096;
  const sampleRate = 16000; // Whisper native sample rate
  const samplesPerChunk = sampleRate * chunkDuration;

  // WAV encoding utilities (same as useAudioRecorder)
  const floatTo16BitPCM = useCallback((input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }, []);

  const writeString = useCallback((view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }, []);

  const addWAVHeader = useCallback(
    (samples: Int16Array): ArrayBuffer => {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);

      // RIFF chunk descriptor
      writeString(view, 0, "RIFF");
      view.setUint32(4, 36 + samples.length * 2, true);
      writeString(view, 8, "WAVE");

      // fmt sub-chunk
      writeString(view, 12, "fmt ");
      view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, 1, true); // NumChannels (1 for Mono)
      view.setUint32(24, sampleRate, true); // SampleRate
      view.setUint32(28, sampleRate * 2, true); // ByteRate
      view.setUint16(32, 2, true); // BlockAlign
      view.setUint16(34, 16, true); // BitsPerSample

      // data sub-chunk
      writeString(view, 36, "data");
      view.setUint32(40, samples.length * 2, true);

      // Write samples
      const sampleBytes = new Int16Array(buffer, 44);
      sampleBytes.set(samples);

      return buffer;
    },
    [sampleRate, writeString]
  );

  const processBuffer = useCallback((): Blob | null => {
    if (audioBufferRef.current.length === 0) {
      return null;
    }

    // Flatten buffer
    const totalLength = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioBufferRef.current) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // Clear buffer for next chunk
    audioBufferRef.current = [];

    // Convert to 16-bit PCM
    const pcm16 = floatTo16BitPCM(result);

    // Add WAV header
    const wavBytes = addWAVHeader(pcm16);

    // Create blob
    return new Blob([wavBytes], { type: "audio/wav" });
  }, [floatTo16BitPCM, addWAVHeader]);

  const sendChunk = useCallback(
    async (audioBlob: Blob, index: number) => {
      if (!sessionIdRef.current) return;

      try {
        const formData = new FormData();
        formData.append("audio_chunk", audioBlob, `chunk_${index}.wav`);
        formData.append("chunk_index", index.toString());

        const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8004";
        const response = await axios.post(
          `${websocketUrl}/api/meetings/${sessionIdRef.current}/chunk`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
            timeout: 30000, // 30 seconds timeout
          }
        );

        if (response.data) {
          console.log(`Chunk ${index} processed successfully`);
          setState((prev) => ({
            ...prev,
            chunksProcessed: prev.chunksProcessed + 1,
            chunksPending: Math.max(0, prev.chunksPending - 1),
          }));
        }
      } catch (error) {
        console.error(`Failed to send chunk ${index}:`, error);
        const errorMessage =
          axios.isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : axios.isAxiosError(error)
            ? error.message
            : error instanceof Error
            ? error.message
            : "Failed to send chunk";
        setState((prev) => ({ ...prev, error: errorMessage }));
        onError?.(errorMessage);
      }
    },
    [onError]
  );

  const processQueue = useCallback(async () => {
    if (isUploadingRef.current || chunkQueueRef.current.length === 0) return;

    isUploadingRef.current = true;

    try {
      while (chunkQueueRef.current.length > 0) {
        const item = chunkQueueRef.current.shift();
        if (item) {
          await sendChunk(item.blob, item.index);
        }
      }
    } catch (error) {
      console.error("Queue processing error:", error);
    } finally {
      isUploadingRef.current = false;
      // Check if more items were added while we were processing
      if (chunkQueueRef.current.length > 0) {
        processQueue();
      }
    }
  }, [sendChunk]);

  const connectWebSocket = useCallback((sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const protocol = process.env.NODE_ENV === "production" ? "wss" : "ws";
    const wsHost = process.env.NEXT_PUBLIC_WEBSOCKET_HOST || "localhost";
    const wsPort = process.env.NEXT_PUBLIC_WEBSOCKET_PORT || "8004";
    const wsUrl = `${protocol}://${wsHost}:${wsPort}/ws/chat/${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for meeting session: ${sessionId}`);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle transcript updates
          if (message.type === "transcript_update" && message.session_id === sessionId) {
            const transcript = message.content || "";
            setState((prev) => ({ ...prev, liveTranscript: transcript }));
            onTranscriptUpdate?.(transcript);
          }
          
          // Handle meeting stopped event
          if (message.type === "system" && message.event === "meeting_stopped") {
            console.log("Meeting stopped event received");
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log(`WebSocket disconnected for meeting session: ${sessionId}`);
        wsRef.current = null;
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [onTranscriptUpdate]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      audioBufferRef.current = [];
      chunkQueueRef.current = [];
      chunkIndexRef.current = 0;
      isUploadingRef.current = false;
      isRecordingRef.current = true;

      setState((prev) => ({
        ...prev,
        isRecording: true,
        duration: 0,
        chunkCount: 0,
        chunksProcessed: 0,
        chunksPending: 0,
        liveTranscript: "",
        error: null,
        sessionId: null,
      }));

      // Start recording session on server
      const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8004";
      const response = await axios.post(`${websocketUrl}/api/meetings/start`, {}, {
        timeout: 10000, // 10 seconds timeout
      });

      if (!response.data) {
        throw new Error("No response data from server");
      }

      const sessionId = response.data.session_id || response.data.session?.session_id;
      if (!sessionId) {
        throw new Error("No session ID received from server");
      }

      sessionIdRef.current = sessionId;
      setState((prev) => ({ ...prev, sessionId }));
      onSessionStart?.(sessionId);

      // Connect WebSocket for real-time transcript updates
      connectWebSocket(sessionId);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Initialize AudioContext
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass({
        sampleRate: sampleRate,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessor for wide compatibility
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        // Strictly check if we are still recording
        if (!isRecordingRef.current || !sessionIdRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Clone data to avoid reference issues
        const pcmData = new Float32Array(inputData);
        audioBufferRef.current.push(pcmData);

        // Check if we have enough data for a chunk
        const currentLength = audioBufferRef.current.reduce(
          (acc, chunk) => acc + chunk.length,
          0
        );
        if (currentLength >= samplesPerChunk) {
          const blob = processBuffer();
          if (blob) {
            const index = chunkIndexRef.current;
            chunkQueueRef.current.push({ blob, index });
            chunkIndexRef.current++;
            setState((prev) => ({
              ...prev,
              chunkCount: prev.chunkCount + 1,
              chunksPending: prev.chunksPending + 1,
            }));
            processQueue();
          }
        }
      };

      // Start timer for duration
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : axios.isAxiosError(error)
          ? error.message
          : error instanceof Error
          ? error.message
          : "Failed to start recording";
      isRecordingRef.current = false;
      setState((prev) => ({ ...prev, error: errorMessage, isRecording: false }));
      onError?.(errorMessage);
    }
  }, [sampleRate, bufferSize, samplesPerChunk, processBuffer, processQueue, connectWebSocket, onError, onSessionStart]);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    try {
      // Stop accepting new data immediately
      isRecordingRef.current = false;

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Disconnect WebSocket
      disconnectWebSocket();

      // Stop capturing audio hardware
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      // Disconnect audio processing nodes
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Process whatever is left in the buffer (final chunk)
      if (audioBufferRef.current.length > 0) {
        console.log("Processing final buffer...");
        const blob = processBuffer();
        if (blob) {
          const index = chunkIndexRef.current;
          chunkQueueRef.current.push({ blob, index });
          chunkIndexRef.current++;
          setState((prev) => ({
            ...prev,
            chunkCount: prev.chunkCount + 1,
            chunksPending: prev.chunksPending + 1,
          }));
          await processQueue();
        }
      }

      // Wait for queue to drain
      console.log("Waiting for uploads to complete...");
      while (chunkQueueRef.current.length > 0 || isUploadingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Finally, tell backend to stop the session
      if (sessionIdRef.current) {
        console.log("Stopping session on server...");
        const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8004";
        const response = await axios.post(
          `${websocketUrl}/api/meetings/${sessionIdRef.current}/stop`,
          {},
          {
            timeout: 30000, // 30 seconds timeout for final processing
          }
        );

        if (response.data) {
          // Final transcript will be received via WebSocket
          onSessionStop?.();
        } else {
          throw new Error("Failed to stop recording session");
        }
      }

      setState((prev) => ({ ...prev, isRecording: false }));
    } catch (error) {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : axios.isAxiosError(error)
          ? error.message
          : error instanceof Error
          ? error.message
          : "Failed to stop recording";
      setState((prev) => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [processBuffer, processQueue, disconnectWebSocket, onError, onSessionStop]);

  const cancelRecording = useCallback(() => {
    // Stop recording immediately
    isRecordingRef.current = false;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Disconnect WebSocket
    disconnectWebSocket();

    // Stop capturing audio hardware
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect audio processing nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset state
    audioBufferRef.current = [];
    chunkQueueRef.current = [];
    chunkIndexRef.current = 0;
    isUploadingRef.current = false;
    sessionIdRef.current = null;

    setState({
      isRecording: false,
      duration: 0,
      chunkCount: 0,
      chunksProcessed: 0,
      chunksPending: 0,
      liveTranscript: "",
      error: null,
      sessionId: null,
    });
  }, [disconnectWebSocket]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnectWebSocket]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  };
}

