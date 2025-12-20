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
}

interface UseAudioRecorderOptions {
  onTranscriptionComplete?: (audioBlob: Blob) => void;
  onError?: (error: string) => void;
  sampleRate?: number;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const {
    onTranscriptionComplete,
    onError,
    sampleRate = 16000, // Whisper native sample rate
  } = options;

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    isTranscribing: false,
    duration: 0,
    audioBlob: null,
    transcribedText: "",
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const bufferSize = 4096;

  // WAV encoding utilities
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
      view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
      view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
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

  const processBuffer = useCallback((): Blob => {
    if (audioBufferRef.current.length === 0) {
      return new Blob([], { type: "audio/wav" });
    }

    // Flatten buffer
    const totalLength = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioBufferRef.current) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to 16-bit PCM
    const pcm16 = floatTo16BitPCM(result);

    // Add WAV header
    const wavBytes = addWAVHeader(pcm16);

    // Create blob
    return new Blob([wavBytes], { type: "audio/wav" });
  }, [floatTo16BitPCM, addWAVHeader]);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      audioBufferRef.current = [];
      isRecordingRef.current = true;
      isPausedRef.current = false;

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        transcribedText: "",
        error: null,
      }));

      // Get microphone access with audio constraints
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
      // Note: ScriptProcessorNode is deprecated in favor of AudioWorkletNode
      // AudioWorklet requires a separate worklet file and more complex setup
      // For now, we use ScriptProcessor for simplicity and compatibility
      // TODO: Migrate to AudioWorkletNode in the future
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        // Strictly check if we are still recording
        if (!isRecordingRef.current || isPausedRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Clone data to avoid reference issues
        const pcmData = new Float32Array(inputData);
        audioBufferRef.current.push(pcmData);
      };

      // Start timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      isRecordingRef.current = false;
      setState((prev) => ({ ...prev, error: errorMessage, isRecording: false }));
      onError?.(errorMessage);
    }
  }, [sampleRate, bufferSize, onError]);

  const stopRecording = useCallback(async () => {
    // Update refs first
    isRecordingRef.current = false;
    isPausedRef.current = false;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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

    // Process whatever is left in the buffer
    const audioBlob = processBuffer();
    audioBufferRef.current = []; // Clear buffer

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      audioBlob,
    }));

    // Call completion callback with the audio blob
    if (audioBlob.size > 0) {
      onTranscriptionComplete?.(audioBlob);
    }

    return audioBlob;
  }, [processBuffer, onTranscriptionComplete]);

  const pauseRecording = useCallback(() => {
    if (isRecordingRef.current && !isPausedRef.current) {
      isPausedRef.current = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (isRecordingRef.current && isPausedRef.current) {
      isPausedRef.current = false;
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Update refs first
    isRecordingRef.current = false;
    isPausedRef.current = false;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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

    setState({
      isRecording: false,
      isPaused: false,
      isTranscribing: false,
      duration: 0,
      audioBlob: null,
      transcribedText: "",
      error: null,
    });
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
