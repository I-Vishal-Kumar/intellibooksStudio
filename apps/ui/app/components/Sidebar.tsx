"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Workflow,
  FileText,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "agents", label: "Agents", icon: Bot, path: "/agents" },
  { id: "workflows", label: "Workflows", icon: Workflow, path: "/workflows" },
  { id: "audio", label: "Audio Processing", icon: FileText, path: "/audio" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" },
  { id: "knowledge", label: "Studio", icon: BookOpen, path: "/studio" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className="w-64 bg-white/60 backdrop-blur-xl border-r border-gray-200/50 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="w-6 h-6 text-white font-bold text-sm">IB</div>
          </div>
          <span className="text-lg font-bold text-gray-900">Intellibooks</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.path)}
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
        <button
          onClick={() => handleNavClick("/settings")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
            pathname === "/settings"
              ? "bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-900/5 text-gray-900 font-medium"
              : "text-gray-600 hover:bg-white/40 hover:text-gray-900"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
