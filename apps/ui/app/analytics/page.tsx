"use client";

import { useUser } from "@clerk/nextjs";
import { PageLayout } from "../components/PageLayout";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  FileText,
  Bot,
  Calendar,
} from "lucide-react";

const stats = [
  {
    label: "Total Tasks",
    value: "12,847",
    change: "+18%",
    trend: "up",
    icon: Zap,
  },
  {
    label: "Documents Processed",
    value: "3,421",
    change: "+12%",
    trend: "up",
    icon: FileText,
  },
  {
    label: "Avg Processing Time",
    value: "4.2s",
    change: "-8%",
    trend: "down",
    icon: Clock,
  },
  {
    label: "Active Agents",
    value: "6",
    change: "0%",
    trend: "neutral",
    icon: Bot,
  },
];

const weeklyData = [
  { day: "Mon", tasks: 1240, documents: 320 },
  { day: "Tue", tasks: 1580, documents: 410 },
  { day: "Wed", tasks: 1820, documents: 520 },
  { day: "Thu", tasks: 2100, documents: 580 },
  { day: "Fri", tasks: 1950, documents: 490 },
  { day: "Sat", tasks: 890, documents: 210 },
  { day: "Sun", tasks: 720, documents: 180 },
];

const agentUsage = [
  { name: "Transcription", percentage: 35, tasks: 4496 },
  { name: "Translation", percentage: 25, tasks: 3212 },
  { name: "Summarization", percentage: 20, tasks: 2569 },
  { name: "Intent Detection", percentage: 12, tasks: 1542 },
  { name: "Keywords", percentage: 8, tasks: 1028 },
];

export default function AnalyticsPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const maxTasks = Math.max(...weeklyData.map((d) => d.tasks));

  return (
    <PageLayout
      title="Analytics"
      description="Monitor performance and usage metrics"
      actions={
        <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-gray-200/50">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Last 7 days</span>
        </div>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? TrendingUp : stat.trend === "down" ? TrendingDown : null;
          const trendColor = stat.trend === "up" ? "text-green-600" : stat.trend === "down" ? "text-green-600" : "text-gray-500";

          return (
            <div
              key={stat.label}
              className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Icon className="w-5 h-5" />
                </div>
                {TrendIcon && (
                  <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                    <TrendIcon className="w-4 h-4" />
                    {stat.change}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Activity Chart */}
        <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Activity</h3>
          <div className="flex items-end justify-between h-48 gap-2">
            {weeklyData.map((data) => (
              <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg transition-all hover:from-indigo-600 hover:to-purple-600"
                  style={{ height: `${(data.tasks / maxTasks) * 100}%` }}
                  title={`${data.tasks} tasks`}
                />
                <span className="text-xs text-gray-500">{data.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded" />
              <span className="text-gray-600">Tasks Processed</span>
            </div>
          </div>
        </div>

        {/* Agent Usage */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Agent Usage</h3>
          <div className="space-y-4">
            {agentUsage.map((agent) => (
              <div key={agent.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{agent.name}</span>
                  <span className="text-sm text-gray-500">{agent.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${agent.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{agent.tasks.toLocaleString()} tasks</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Workflow</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Duration</th>
                <th className="pb-3 font-medium">Tasks</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { time: "2 min ago", workflow: "Full Audio Pipeline", status: "completed", duration: "45s", tasks: 5 },
                { time: "5 min ago", workflow: "Transcribe & Translate", status: "completed", duration: "12s", tasks: 2 },
                { time: "8 min ago", workflow: "Text Analysis", status: "completed", duration: "6s", tasks: 3 },
                { time: "15 min ago", workflow: "Full Audio Pipeline", status: "completed", duration: "52s", tasks: 5 },
                { time: "22 min ago", workflow: "Meeting Notes", status: "completed", duration: "38s", tasks: 3 },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 text-gray-600">{row.time}</td>
                  <td className="py-3 font-medium text-gray-900">{row.workflow}</td>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-600">{row.duration}</td>
                  <td className="py-3 text-gray-600">{row.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}
