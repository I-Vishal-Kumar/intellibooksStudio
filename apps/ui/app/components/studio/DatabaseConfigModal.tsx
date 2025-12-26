"use client";

import { FC, useState, useEffect } from "react";
import { X, Database, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getDatabaseConfig,
    saveDatabaseConfig,
    type DatabaseConfig,
} from "@/lib/api";

interface DatabaseConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    onConfigSaved?: () => void;
}

const DatabaseConfigModal: FC<DatabaseConfigModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    onConfigSaved,
}) => {
    const queryClient = useQueryClient();
    
    // Default config
    const defaultConfig: DatabaseConfig = {
        db_type: "postgresql",
        host: "localhost",
        port: 5432,
        database: "",
        user: "",
        password: "",
        schema: "public",
        ssl_mode: "prefer",
        pool_size: 10,
        max_overflow: 20,
    };

    // Query to load existing config
    const {
        data: existingConfig,
        isLoading: isLoadingConfig,
    } = useQuery({
        queryKey: ["databaseConfig", sessionId],
        queryFn: () => getDatabaseConfig(sessionId),
        enabled: isOpen && !!sessionId,
        retry: false,
        staleTime: 0, // Always fetch fresh config when modal opens
    });

    // Get initial config from query or use defaults
    const getInitialConfig = (): DatabaseConfig => {
        if (existingConfig?.configured && existingConfig?.config) {
            return existingConfig.config;
        }
        return defaultConfig;
    };

    const [config, setConfig] = useState<DatabaseConfig>(getInitialConfig);

    // Mutation to test and save config
    const saveMutation = useMutation({
        mutationFn: (config: DatabaseConfig) => saveDatabaseConfig(sessionId, config),
        onSuccess: (data) => {
            if (data.success) {
                // Invalidate and refetch config
                queryClient.invalidateQueries({ queryKey: ["databaseConfig", sessionId] });
                // Call success callback
                setTimeout(() => {
                    onConfigSaved?.();
                    onClose();
                }, 1500);
            }
        },
    });

    // Reset config when modal opens or when existing config changes
    const configKey = `${isOpen}-${existingConfig?.configured}-${sessionId}`;
    useEffect(() => {
        if (isOpen) {
            setConfig(getInitialConfig());
            saveMutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configKey]);

    const handleTestConnection = async () => {
        saveMutation.mutate(config);
    };

    const handleSave = async () => {
        saveMutation.mutate(config);
    };

    if (!isOpen) return null;

    const getErrorMessage = (error: unknown): string | null => {
        if (error instanceof Error) {
            return error.message;
        }
        if (error && typeof error === "object" && "response" in error) {
            const axiosError = error as { response?: { data?: { detail?: string; message?: string } } };
            return axiosError.response?.data?.detail || axiosError.response?.data?.message || null;
        }
        if (error && typeof error === "object" && "message" in error) {
            return String((error as { message: unknown }).message);
        }
        return null;
    };

    const errorMessage = saveMutation.error ? getErrorMessage(saveMutation.error) : null;

    const successMessage = saveMutation.data?.success
        ? saveMutation.data.message || "Database configuration saved successfully!"
        : null;

    const testResult = saveMutation.data
        ? {
              success: saveMutation.data.success,
              message: saveMutation.data.message || "Connection successful!",
          }
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Database className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Database Configuration
                            </h2>
                            <p className="text-sm text-gray-500">
                                Configure database connection for analytics queries
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Loading state */}
                    {isLoadingConfig && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                            <span className="ml-2 text-gray-600">Loading configuration...</span>
                        </div>
                    )}

                    {/* Database Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Database Type
                        </label>
                        <select
                            value={config.db_type}
                            onChange={(e) => setConfig({ ...config, db_type: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="postgresql">PostgreSQL</option>
                            <option value="snowflake">Snowflake (Coming Soon)</option>
                            <option value="mysql">MySQL (Coming Soon)</option>
                            <option value="sqlite">SQLite (Coming Soon)</option>
                        </select>
                    </div>

                    {/* Host and Port */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Host
                            </label>
                            <input
                                type="text"
                                value={config.host}
                                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="localhost"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Port
                            </label>
                            <input
                                type="number"
                                value={config.port}
                                onChange={(e) =>
                                    setConfig({ ...config, port: parseInt(e.target.value) || 5432 })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="5432"
                            />
                        </div>
                    </div>

                    {/* Database and Schema */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Database Name
                            </label>
                            <input
                                type="text"
                                value={config.database}
                                onChange={(e) =>
                                    setConfig({ ...config, database: e.target.value })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="mydb"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Schema (Optional)
                            </label>
                            <input
                                type="text"
                                value={config.schema || ""}
                                onChange={(e) => setConfig({ ...config, schema: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="public"
                            />
                        </div>
                    </div>

                    {/* User and Password */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={config.user}
                                onChange={(e) => setConfig({ ...config, user: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="myuser"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={config.password}
                                onChange={(e) =>
                                    setConfig({ ...config, password: e.target.value })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* SSL Mode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            SSL Mode (Optional)
                        </label>
                        <select
                            value={config.ssl_mode || "prefer"}
                            onChange={(e) => setConfig({ ...config, ssl_mode: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="prefer">Prefer</option>
                            <option value="require">Require</option>
                            <option value="disable">Disable</option>
                            <option value="allow">Allow</option>
                        </select>
                    </div>

                    {/* Connection Pool Settings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pool Size
                            </label>
                            <input
                                type="number"
                                value={config.pool_size}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        pool_size: parseInt(e.target.value) || 10,
                                    })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                min="1"
                                max="50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Overflow
                            </label>
                            <input
                                type="number"
                                value={config.max_overflow}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        max_overflow: parseInt(e.target.value) || 20,
                                    })
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div
                            className={`p-4 rounded-lg flex items-center gap-3 ${
                                testResult.success
                                    ? "bg-green-50 border border-green-200"
                                    : "bg-red-50 border border-red-200"
                            }`}
                        >
                            {testResult.success ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                            <p
                                className={`text-sm ${
                                    testResult.success ? "text-green-700" : "text-red-700"
                                }`}
                            >
                                {testResult.message}
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="text-sm text-red-700">{errorMessage}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <p className="text-sm text-green-700">{successMessage}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleTestConnection}
                        disabled={saveMutation.isPending}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Testing...
                            </>
                        ) : (
                            "Test Connection"
                        )}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Configuration"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseConfigModal;
