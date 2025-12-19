"use client";

import { useState } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { AudioUploader } from "@/components/AudioUploader";
import { ChatInterface } from "@/components/ChatInterface";
import { ProcessingOptions } from "@/components/ProcessingOptions";
import { ResultsPanel } from "@/components/ResultsPanel";
import { Mic, FileAudio, Brain, Languages } from "lucide-react";

export default function Home() {
  // const { isSignedIn, user } = useUser();
  // const [processingResult, setProcessingResult] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                Audio Insight
              </span>
            </div>
{/* 
            <div className="flex items-center gap-4">
              {isSignedIn ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <SignInButton mode="modal">
                  <button className="btn-primary">Sign In</button>
                </SignInButton>
              )}
            </div> */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Audio Analysis
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transcribe, translate, summarize, and extract insights from your
            audio files with advanced AI agents.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <FeatureCard
            icon={<Mic className="w-6 h-6" />}
            title="Transcription"
            description="Accurate speech-to-text"
          />
          <FeatureCard
            icon={<Languages className="w-6 h-6" />}
            title="Translation"
            description="30+ languages supported"
          />
          <FeatureCard
            icon={<FileAudio className="w-6 h-6" />}
            title="Summarization"
            description="Key points extraction"
          />
          <FeatureCard
            icon={<Brain className="w-6 h-6" />}
            title="Intent Analysis"
            description="Understand the context"
          />
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Upload & Options */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Upload Audio</h2>
              <AudioUploader onUploadComplete={(file) => console.log(file)} />
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Processing Options</h2>
              <ProcessingOptions />
            </div>
          </div>

          {/* Right Panel - Chat & Results */}
          <div className="space-y-6">
            <div className="card h-[500px] flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Chat Interface</h2>
              <ChatInterface />
            </div>

            {/* {processingResult && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Results</h2>
                <ResultsPanel result={processingResult} />
              </div>
            )} */}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Audio Insight Platform - Powered by AI Agents
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary-300 transition-colors">
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
