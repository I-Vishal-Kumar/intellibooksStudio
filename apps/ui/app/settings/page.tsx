"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PageLayout } from "../components/PageLayout";
import {
  User,
  Key,
  Bell,
  Palette,
  Database,
  Bot,
  Globe,
  Shield,
  Save,
} from "lucide-react";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "api", label: "API Keys", icon: Key },
  { id: "agents", label: "Agent Settings", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function SettingsPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState({
    whisperModel: "base",
    defaultLanguage: "en",
    llmProvider: "openrouter",
    emailNotifications: true,
    processingAlerts: true,
  });

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <PageLayout title="Settings" description="Manage your account and preferences">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <ProfileSettings user={user} />
          )}
          {activeTab === "api" && <APISettings />}
          {activeTab === "agents" && (
            <AgentSettings settings={settings} setSettings={setSettings} />
          )}
          {activeTab === "notifications" && (
            <NotificationSettings settings={settings} setSettings={setSettings} />
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function ProfileSettings({ user }: { user: any }) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h3>

      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
          {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U"}
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-900">
            {user?.firstName} {user?.lastName}
          </h4>
          <p className="text-gray-500">{user?.emailAddresses?.[0]?.emailAddress}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              defaultValue={user?.firstName || ""}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              defaultValue={user?.lastName || ""}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            defaultValue={user?.emailAddresses?.[0]?.emailAddress || ""}
            disabled
            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500"
          />
        </div>
      </div>

      <div className="mt-6">
        <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function APISettings() {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">API Keys</h3>
      <p className="text-sm text-gray-500 mb-6">
        Manage your API keys for LLM providers. Keys are stored securely and never exposed.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              OpenRouter API Key
            </div>
          </label>
          <input
            type="password"
            placeholder="sk-or-..."
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">Used for Claude, GPT-4, and other models</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              OpenAI API Key
            </div>
          </label>
          <input
            type="password"
            placeholder="sk-..."
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Anthropic API Key
            </div>
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-6">
        <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save API Keys
        </button>
      </div>
    </div>
  );
}

function AgentSettings({
  settings,
  setSettings,
}: {
  settings: any;
  setSettings: (s: any) => void;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Agent Settings</h3>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Whisper Model</label>
          <select
            value={settings.whisperModel}
            onChange={(e) => setSettings({ ...settings, whisperModel: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="tiny">Tiny (Fastest)</option>
            <option value="base">Base (Balanced)</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large (Most Accurate)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Larger models are more accurate but slower</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
          <select
            value={settings.defaultLanguage}
            onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
          <select
            value={settings.llmProvider}
            onChange={(e) => setSettings({ ...settings, llmProvider: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="openrouter">OpenRouter (Recommended)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}

function NotificationSettings({
  settings,
  setSettings,
}: {
  settings: any;
  setSettings: (s: any) => void;
}) {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <h4 className="font-medium text-gray-900">Email Notifications</h4>
            <p className="text-sm text-gray-500">Receive updates via email</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.emailNotifications ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.emailNotifications ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <h4 className="font-medium text-gray-900">Processing Alerts</h4>
            <p className="text-sm text-gray-500">Get notified when processing completes</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, processingAlerts: !settings.processingAlerts })}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.processingAlerts ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.processingAlerts ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
