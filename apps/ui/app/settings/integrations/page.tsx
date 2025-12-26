"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import {
  FaGoogle,
  FaCheck,
  FaPlug,
  FaSpinner,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { SiZoho, SiClickup, SiZoom, SiSlack, SiNotion, SiGithub } from "react-icons/si";

interface Integration {
  id: string;
  provider: string;
  connected: boolean;
  email?: string;
  name?: string;
}

interface IntegrationConfig {
  id: string;
  displayName: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  services: string[];
}

// Supported integrations via Nango
const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    id: "google",
    displayName: "Google",
    description: "Gmail, Google Drive, Calendar access",
    icon: <FaGoogle className="w-6 h-6" />,
    color: "bg-red-500",
    services: ["Gmail", "Drive", "Calendar"],
  },
  {
    id: "zoom",
    displayName: "Zoom",
    description: "Meetings, recordings, and transcripts",
    icon: <SiZoom className="w-6 h-6" />,
    color: "bg-blue-500",
    services: ["Meetings", "Recordings"],
  },
  {
    id: "clickup",
    displayName: "ClickUp",
    description: "Tasks and project management",
    icon: <SiClickup className="w-6 h-6" />,
    color: "bg-purple-500",
    services: ["Tasks", "Projects"],
  },
  {
    id: "slack",
    displayName: "Slack",
    description: "Workspace messages and channels",
    icon: <SiSlack className="w-6 h-6" />,
    color: "bg-pink-500",
    services: ["Messages", "Channels"],
  },
  {
    id: "notion",
    displayName: "Notion",
    description: "Pages, databases, and workspaces",
    icon: <SiNotion className="w-6 h-6" />,
    color: "bg-gray-600",
    services: ["Pages", "Databases"],
  },
  {
    id: "github",
    displayName: "GitHub",
    description: "Repositories, issues, and pull requests",
    icon: <SiGithub className="w-6 h-6" />,
    color: "bg-gray-800",
    services: ["Repos", "Issues", "PRs"],
  },
];

// Nango configuration
const NANGO_PUBLIC_KEY = process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY || "";
const NANGO_HOST = process.env.NEXT_PUBLIC_NANGO_HOST || "https://api.nango.dev";

export default function IntegrationsPage() {
  const { user, isLoaded } = useUser();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [nangoReady, setNangoReady] = useState(false);

  // Load Nango frontend SDK
  useEffect(() => {
    if (typeof window !== "undefined" && NANGO_PUBLIC_KEY) {
      const script = document.createElement("script");
      script.src = "https://cdn.nango.dev/nango-frontend.js";
      script.async = true;
      script.onload = () => setNangoReady(true);
      document.body.appendChild(script);
    }
  }, []);

  // Initialize integrations list
  useEffect(() => {
    if (isLoaded && user) {
      // Initialize with all configs as disconnected
      setIntegrations(
        INTEGRATION_CONFIGS.map((config) => ({
          id: config.id,
          provider: config.id,
          connected: false,
        }))
      );
      setLoading(false);

      // If Nango is configured, fetch actual connection status
      if (NANGO_PUBLIC_KEY) {
        fetchConnections();
      }
    }
  }, [isLoaded, user]);

  const fetchConnections = async () => {
    if (!user || !NANGO_PUBLIC_KEY) return;

    try {
      // Fetch connections from your backend which queries Nango
      const response = await fetch(`/api/integrations?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setIntegrations(prev =>
          prev.map(integration => {
            const connection = data.connections?.find(
              (c: any) => c.provider === integration.provider
            );
            return {
              ...integration,
              connected: !!connection,
              email: connection?.email,
            };
          })
        );
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    }
  };

  const handleConnect = useCallback(async (providerId: string) => {
    if (!user) return;

    // Check if Nango is configured
    if (!NANGO_PUBLIC_KEY) {
      alert("OAuth integrations require Nango configuration. See setup instructions.");
      return;
    }

    if (!nangoReady || !(window as any).Nango) {
      alert("Loading... please try again in a moment.");
      return;
    }

    setConnecting(providerId);

    try {
      const nango = new (window as any).Nango({
        publicKey: NANGO_PUBLIC_KEY,
        host: NANGO_HOST,
      });

      // Start OAuth flow via Nango
      const result = await nango.auth(providerId, user.id);

      if (result) {
        // Update local state
        setIntegrations(prev =>
          prev.map(i =>
            i.provider === providerId ? { ...i, connected: true } : i
          )
        );
      }
    } catch (error: any) {
      console.error("OAuth error:", error);
      if (error.message !== "User cancelled") {
        alert(`Failed to connect: ${error.message}`);
      }
    } finally {
      setConnecting(null);
    }
  }, [user, nangoReady]);

  const handleDisconnect = async (providerId: string) => {
    if (!user || !NANGO_PUBLIC_KEY) return;

    try {
      // Call your backend to delete the connection
      const response = await fetch(`/api/integrations/${providerId}?userId=${user.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIntegrations(prev =>
          prev.map(i =>
            i.provider === providerId ? { ...i, connected: false, email: undefined } : i
          )
        );
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <FaSpinner className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Please sign in to manage integrations</p>
      </div>
    );
  }

  const showSetupNotice = !NANGO_PUBLIC_KEY;

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FaPlug className="text-blue-500" />
            Integrations
          </h1>
          <p className="text-gray-400 mt-2">
            Connect your accounts to enable AI-powered features across your tools
          </p>
        </div>

        {/* Setup Notice */}
        {showSetupNotice && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <h3 className="text-yellow-400 font-semibold mb-2">Setup Required</h3>
            <p className="text-gray-300 text-sm mb-3">
              To enable OAuth integrations, you need to configure Nango (free):
            </p>
            <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside mb-3">
              <li>Sign up at <a href="https://nango.dev" target="_blank" rel="noopener" className="text-blue-400 hover:underline">nango.dev</a> (free tier available)</li>
              <li>Get your public key from the Nango dashboard</li>
              <li>Add to your .env: <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_NANGO_PUBLIC_KEY=your-key</code></li>
            </ol>
            <a
              href="https://docs.nango.dev/introduction"
              target="_blank"
              rel="noopener"
              className="text-blue-400 hover:underline text-sm flex items-center gap-1"
            >
              View Nango Docs <FaExternalLinkAlt className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Integration Cards */}
        <div className="grid gap-4">
          {INTEGRATION_CONFIGS.map((config) => {
            const integration = integrations.find(i => i.provider === config.id);
            const isConnected = integration?.connected || false;
            const isConnecting = connecting === config.id;

            return (
              <div
                key={config.id}
                className={`bg-gray-800 rounded-xl p-5 border transition-all ${
                  isConnected
                    ? "border-green-500/30 shadow-lg shadow-green-500/5"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left side */}
                  <div className="flex gap-4 items-center">
                    <div className={`${config.color} p-3 rounded-lg text-white`}>
                      {config.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        {config.displayName}
                        {isConnected && (
                          <span className="text-green-400 text-sm flex items-center gap-1">
                            <FaCheck className="w-3 h-3" /> Connected
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-400 text-sm">{config.description}</p>
                      {isConnected && integration?.email && (
                        <p className="text-gray-500 text-xs mt-1">
                          {integration.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side - Button */}
                  <div>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(config.id)}
                        className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(config.id)}
                        disabled={isConnecting || showSetupNotice}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? (
                          <>
                            <FaSpinner className="w-4 h-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          "Connect"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* How it works */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-3">How it works</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center p-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <p className="text-gray-300">Click "Connect" on any service</p>
            </div>
            <div className="text-center p-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">2</span>
              </div>
              <p className="text-gray-300">Login with your account credentials</p>
            </div>
            <div className="text-center p-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-blue-400 font-bold">3</span>
              </div>
              <p className="text-gray-300">AI can now access your data securely</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs text-center mt-4">
            Your credentials are encrypted and never stored directly. You can disconnect anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
