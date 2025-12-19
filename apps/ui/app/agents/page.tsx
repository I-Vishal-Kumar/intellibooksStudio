"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PageLayout } from "../components/PageLayout";
import {
  Bot,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Settings,
  MoreVertical,
} from "lucide-react";

const agents = [
  {
    id: "transcription",
    name: "Transcription Agent",
    description: "Converts audio to text using OpenAI Whisper",
    status: "active",
    tasks: 1247,
    avgTime: "4.2s",
    accuracy: 94,
    icon: "bg-green-500",
  },
  {
    id: "translation",
    name: "Translation Agent",
    description: "Multi-language translation with context preservation",
    status: "active",
    tasks: 892,
    avgTime: "2.1s",
    accuracy: 89,
    icon: "bg-amber-500",
  },
  {
    id: "summarization",
    name: "Summarization Agent",
    description: "Generates summaries with key points extraction",
    status: "active",
    tasks: 654,
    avgTime: "8.7s",
    accuracy: 92,
    icon: "bg-blue-500",
  },
  {
    id: "intent",
    name: "Intent Detection Agent",
    description: "Classifies content intent and sentiment",
    status: "active",
    tasks: 423,
    avgTime: "1.5s",
    accuracy: 97,
    icon: "bg-purple-500",
  },
  {
    id: "keyword",
    name: "Keyword Extraction Agent",
    description: "Extracts keywords, keyphrases, and entities",
    status: "idle",
    tasks: 312,
    avgTime: "1.2s",
    accuracy: 91,
    icon: "bg-pink-500",
  },
  {
    id: "orchestrator",
    name: "Orchestrator Agent",
    description: "Coordinates multi-agent workflows",
    status: "active",
    tasks: 2156,
    avgTime: "0.5s",
    accuracy: 99,
    icon: "bg-indigo-500",
  },
];

export default function AgentsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [filter, setFilter] = useState<"all" | "active" | "idle">("all");

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const filteredAgents = agents.filter((agent) => {
    if (filter === "all") return true;
    return agent.status === filter;
  });

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasks, 0);

  return (
    <PageLayout
      title="Agents"
      description="Manage and monitor your AI agents"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Agents"
          value={agents.length.toString()}
          icon={<Bot className="w-5 h-5" />}
        />
        <StatCard
          label="Active"
          value={activeCount.toString()}
          icon={<Activity className="w-5 h-5" />}
          color="text-green-600"
        />
        <StatCard
          label="Total Tasks"
          value={totalTasks.toLocaleString()}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Accuracy"
          value="93.7%"
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {(["all", "active", "idle"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? "bg-indigo-500 text-white"
                : "bg-white/60 text-gray-600 hover:bg-white/80"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </PageLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-gray-900",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600">
          {icon}
        </div>
        <div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: typeof agents[0] }) {
  const isActive = agent.status === "active";

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${agent.icon} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          <Bot className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {agent.status}
          </span>
          <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1">{agent.name}</h3>
      <p className="text-sm text-gray-500 mb-4">{agent.description}</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-sm font-semibold text-gray-900">{agent.tasks}</div>
          <div className="text-xs text-gray-500">Tasks</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-sm font-semibold text-gray-900">{agent.avgTime}</div>
          <div className="text-xs text-gray-500">Avg Time</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-sm font-semibold text-gray-900">{agent.accuracy}%</div>
          <div className="text-xs text-gray-500">Accuracy</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
            isActive
              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isActive ? "Pause" : "Start"}
        </button>
        <button className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
