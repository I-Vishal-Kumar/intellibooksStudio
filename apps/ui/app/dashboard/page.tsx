"use client";

import { useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Workflow,
  FileText,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  RefreshCw,
  Plus,
  Filter,
  Bell,
  Users,
  Zap,
  Clock,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("dashboard");

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const handleNavClick = (navId: string) => {
    setActiveNav(navId);
    const routes: Record<string, string> = {
      dashboard: "/dashboard",
      agents: "/agents",
      workflows: "/workflows",
      audio: "/audio",
      chat: "/chat",
      knowledge: "/dashboard/v2",  // Use v2 dashboard with session persistence
      analytics: "/analytics",
      settings: "/settings",
    };
    if (routes[navId]) {
      router.push(routes[navId]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar activeNav={activeNav} setActiveNav={handleNavClick} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Monitor your AI agents and workflows
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-200/50 hover:bg-white/80 transition-all">
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                </button>
                <button className="px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium flex items-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20">
                  <Plus className="w-4 h-4" />
                  New Agent
                </button>
                <UserButton afterSignOutUrl="/sign-in" />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={<Users className="w-5 h-5" />}
                value="12"
                label="Active Agents"
                trend="↑2"
                iconBg="bg-green-500"
              />
              <MetricCard
                icon={<Zap className="w-5 h-5" />}
                value="3,216"
                label="Tasks Processed"
                trend="↑18%"
                iconBg="bg-gray-400"
              />
              <MetricCard
                icon={<Clock className="w-5 h-5" />}
                value="4.2s"
                label="Avg Response Time"
                trend="↑12%"
                iconBg="bg-gray-400"
              />
              <MetricCard
                icon={<Shield className="w-5 h-5" />}
                value="99.7%"
                label="Compliance Score"
                trend="↑0.3%"
                iconBg="bg-gray-400"
              />
            </div>

            {/* Active Agents and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Active Agents Section */}
              <div className="lg:col-span-2">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Active Agents
                    </h2>
                    <button className="p-2 rounded-2xl bg-white/60 backdrop-blur-sm border border-gray-200/50 hover:bg-white/80 transition-all">
                      <Filter className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AgentCard
                      name="Transcription Agent"
                      badge="L4"
                      description="Audio to Text"
                      tasks="1,247 tasks"
                      responseTime="4.2s"
                      confidence={94}
                      iconBg="bg-green-500"
                    />
                    <AgentCard
                      name="Translation Agent"
                      badge="L3"
                      description="Multi-language"
                      tasks="892 tasks"
                      responseTime="2.1s"
                      confidence={89}
                      iconBg="bg-amber-600"
                    />
                    <AgentCard
                      name="Summarization Agent"
                      badge="L4"
                      description="Key Points Extract"
                      tasks="654 tasks"
                      responseTime="8.7s"
                      confidence={92}
                      iconBg="bg-blue-600"
                    />
                    <AgentCard
                      name="Intent Agent"
                      badge="L3"
                      description="Intent & Keywords"
                      tasks="423 tasks"
                      responseTime="5.3s"
                      confidence={97}
                      iconBg="bg-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recent Activity
                  </h2>
                  <Bell className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-4">
                  <ActivityItem
                    text="Audio file transcribed successfully"
                    agent="Transcription Agent"
                    time="2 min ago"
                    status="success"
                  />
                  <ActivityItem
                    text="Translation to Spanish completed"
                    agent="Translation Agent"
                    time="5 min ago"
                    status="success"
                  />
                  <ActivityItem
                    text="Summary generated with 5 key points"
                    agent="Summarization Agent"
                    time="8 min ago"
                    status="success"
                  />
                  <ActivityItem
                    text="Intent detected: Support inquiry"
                    agent="Intent Agent"
                    time="12 min ago"
                    status="success"
                  />
                  <ActivityItem
                    text="Audio quality too low for processing"
                    agent="Transcription Agent"
                    time="15 min ago"
                    status="warning"
                  />
                </div>
              </div>
            </div>

            {/* Live Processing Flow */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Live Processing Flow
                </h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600 font-medium">Live</span>
                </div>
              </div>
              <ProcessingFlow />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Sidebar Component
function Sidebar({
  activeNav,
  setActiveNav,
}: {
  activeNav: string;
  setActiveNav: (nav: string) => void;
}) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "workflows", label: "Workflows", icon: Workflow },
    { id: "audio", label: "Audio Processing", icon: FileText },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="w-64 bg-white/60 backdrop-blur-xl border-r border-gray-200/50 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-6 h-6 text-white font-bold">IB</div>
          </div>
          <span className="text-lg font-bold text-gray-900">Intellibooks Studio</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                isActive
                  ? "bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-900/5 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-white/40 hover:text-gray-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-gray-200/50">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-600 hover:bg-white/40 hover:text-gray-900 transition-all">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon,
  value,
  label,
  trend,
  iconBg,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  trend: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-gray-200/50 p-6 shadow-xl shadow-gray-900/5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${iconBg} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-xl">
          {trend}
        </span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

// Agent Card Component
function AgentCard({
  name,
  badge,
  description,
  tasks,
  responseTime,
  confidence,
  iconBg,
}: {
  name: string;
  badge: string;
  description: string;
  tasks: string;
  responseTime: string;
  confidence: number;
  iconBg: string;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center text-white shadow-md`}>
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
          {badge}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
        <span>{tasks}</span>
        <span>{responseTime}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Confidence</span>
          <span className="font-medium text-gray-700">{confidence}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({
  text,
  agent,
  time,
  status,
}: {
  text: string;
  agent: string;
  time: string;
  status: "success" | "warning" | "error";
}) {
  const statusConfig = {
    success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50" },
    warning: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50" },
    error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3">
      <div className={`w-2 h-2 ${config.color} rounded-full mt-2 flex-shrink-0`}></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium">{text}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{agent}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
      </div>
    </div>
  );
}

// Processing Flow Component
function ProcessingFlow() {
  const steps = [
    { label: "Audio", status: "completed", icon: FileText, message: "File uploaded" },
    { label: "Transcribe", status: "completed", icon: Bot, message: "Text extracted" },
    { label: "Translate", status: "processing", icon: BookOpen, message: "Processing..." },
    { label: "Summarize", status: "pending", icon: Users, message: "Awaiting" },
    { label: "Analyze", status: "pending", icon: Shield, message: "Awaiting" },
    { label: "Output", status: "pending", icon: CheckCircle2, message: "Awaiting" },
  ];

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        const statusColors = {
          completed: "bg-green-500 text-white",
          processing: "bg-blue-500 text-white animate-pulse",
          pending: "bg-gray-200 text-gray-400",
        };

        return (
          <div key={step.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-3 ${statusColors[step.status as keyof typeof statusColors]}`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-center mb-1">
                <p className="text-sm font-medium text-gray-900">{step.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.message}</p>
              </div>
            </div>
            {!isLast && (
              <div className="flex-1 mx-2 mb-6">
                <div className="h-0.5 bg-gradient-to-r from-gray-300 to-gray-200"></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

