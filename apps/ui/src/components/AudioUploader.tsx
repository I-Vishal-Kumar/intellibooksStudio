"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileAudio, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioUploaderProps {
  onUploadComplete: (file: { id: string; filename: string }) => void;
}

const ACCEPTED_FORMATS = {
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/flac": [".flac"],
  "audio/mp4": [".m4a"],
  "audio/ogg": [".ogg"],
  "audio/aac": [".aac"],
  "audio/webm": [".webm"],
};

export function AudioUploader({ onUploadComplete }: AudioUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/v1/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        setUploadedFile({ id: data.fileId, filename: file.name });
        onUploadComplete({ id: data.fileId, filename: file.name });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const clearFile = () => {
    setUploadedFile(null);
    setError(null);
  };

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <FileAudio className="w-8 h-8 text-green-600" />
        <div className="flex-1">
          <p className="font-medium text-green-900">{uploadedFile.filename}</p>
          <p className="text-sm text-green-600">Ready for processing</p>
        </div>
        <button
          onClick={clearFile}
          className="p-1 hover:bg-green-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-green-600" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
        isDragActive
          ? "border-primary-500 bg-primary-50"
          : "border-gray-300 hover:border-primary-400 hover:bg-gray-50",
        uploading && "pointer-events-none opacity-50"
      )}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
          <p className="text-gray-600">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-700">
              {isDragActive ? "Drop your audio file here" : "Drag & drop audio file"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse (MP3, WAV, FLAC, M4A, OGG, AAC)
            </p>
          </div>
          <p className="text-xs text-gray-400">Maximum file size: 100MB</p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
