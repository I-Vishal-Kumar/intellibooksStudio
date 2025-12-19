"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PageLayout } from "../components/PageLayout";
import {
  Workflow,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  MoreVertical,
} from "lucide-react";

const workflows = [
  {
    id: "full-pipeline",
    name: "Full Audio Pipeline",
    description: "Transcribe, translate, summarize, and analyze audio",
    steps: ["Transcribe", "Translate", "Summarize", "Intent", "Keywords"],
    status: "active",
    runs: 1247,
    lastRun: "2 min ago",
    avgDuration: "45s",
  },
  {
    id: "transcribe-translate",
    name: "Transcribe & Translate",
    description: "Convert audio to text and translate to multiple languages",
    steps: ["Transcribe", "Translate"],
    status: "active",
    runs: 892,
    lastRun: "5 min ago",
    avgDuration: "12s",
  },
  {
    id: "analysis-only",
    name: "Text Analysis",
    description: "Analyze existing text for intent and keywords",
    steps: ["Intent", "Keywords", "Summarize"],
    status: "active",
    runs: 654,
    lastRun: "10 min ago",
    avgDuration: "8s",
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes Generator",
    description: "Generate structured meeting notes from audio recordings",
    steps: ["Transcribe", "Summarize", "Keywords"],
    status: "idle",
    runs: 234,
    lastRun: "1 hour ago",
    avgDuration: "30s",
  },
];

export default function WorkflowsPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <PageLayout
      title="Workflows"
      description="Create and manage automated agent workflows"
      actions={
        <button className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium flex items-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Workflows" value={workflows.length.toString()} />
        <StatCard
          label="Active"
          value={workflows.filter((w) => w.status === "active").length.toString()}
          color="text-green-600"
        />
        <StatCard
          label="Total Runs"
          value={workflows.reduce((sum, w) => sum + w.runs, 0).toLocaleString()}
        />
        <StatCard label="Avg Duration" value="24s" />
      </div>

      {/* Workflow List */}
      <div className="space-y-4">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} />
        ))}
      </div>
    </PageLayout>
  );
}

function StatCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: typeof workflows[0] }) {
  const isActive = workflow.status === "active";

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
            <p className="text-sm text-gray-500">{workflow.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {workflow.status}
          </span>
          <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Steps Visualization */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {workflow.steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <div className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 whitespace-nowrap">
              {step}
            </div>
            {index < workflow.steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            {workflow.runs} runs
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {workflow.avgDuration} avg
          </span>
          <span>Last run: {workflow.lastRun}</span>
        </div>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isActive
              ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {isActive ? <Play className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          Run Now
        </button>
      </div>
    </div>
  );
}
