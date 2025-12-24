import { FC, useState, useEffect } from "react";
import { X, Globe, Copy, Check, Loader2, Link as LinkIcon, Users, Trash2, Shield, UserPlus } from "lucide-react";

interface Collaborator {
    id: string;
    user_id: string;
    role: "viewer" | "editor";
    created_at: string;
}

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId?: string;
    shareToken?: string;
    currentUserId?: string;
}

const ShareModal: FC<ShareModalProps> = ({
    isOpen,
    onClose,
    conversationId,
    shareToken: initialShareToken,
    currentUserId
}) => {
    const [shareToken, setShareToken] = useState(initialShareToken || "");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    // Collaborators state
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [newCollaboratorId, setNewCollaboratorId] = useState("");
    const [newCollaboratorRole, setNewCollaboratorRole] = useState<"viewer" | "editor">("viewer");
    const [inviteLoading, setInviteLoading] = useState(false);

    useEffect(() => {
        if (isOpen && conversationId) {
            fetchCollaborators();
        }
    }, [isOpen, conversationId]);

    const fetchCollaborators = async () => {
        try {
            const res = await fetch(`http://localhost:8004/api/conversations/${conversationId}/collaborators`, {
                headers: { "X-User-Id": currentUserId || "" }
            });
            if (res.ok) {
                const data = await res.json();
                setCollaborators(data);
            }
        } catch (err) {
            console.error("Failed to fetch collaborators:", err);
        }
    };

    const handleAddCollaborator = async () => {
        if (!newCollaboratorId.trim() || !conversationId) return;

        setInviteLoading(true);
        const isEmail = newCollaboratorId.includes("@");
        try {
            const res = await fetch(`http://localhost:8004/api/conversations/${conversationId}/collaborators`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-User-Id": currentUserId || ""
                },
                body: JSON.stringify({
                    [isEmail ? "email" : "user_id"]: newCollaboratorId.trim(),
                    role: newCollaboratorRole
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "Failed to add collaborator");
            }

            setNewCollaboratorId("");
            fetchCollaborators();
        } catch (err: any) {
            setError(err.message || "Failed to add collaborator. Verify the input.");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveCollaborator = async (userId: string) => {
        if (!conversationId) return;

        try {
            const res = await fetch(`http://localhost:8004/api/conversations/${conversationId}/collaborators/${userId}`, {
                method: "DELETE",
                headers: { "X-User-Id": currentUserId || "" }
            });

            if (res.ok) {
                fetchCollaborators();
            }
        } catch (err) {
            console.error("Failed to remove collaborator:", err);
        }
    };

    if (!isOpen) return null;

    const handlePublish = async () => {
        if (!conversationId) return;

        setLoading(true);
        setError("");

        try {
            const res = await fetch(`http://localhost:8004/api/conversations/${conversationId}/publish`, {
                method: "POST",
                headers: { "X-User-Id": currentUserId || "" }
            });

            if (!res.ok) throw new Error("Failed to publish conversation");

            const data = await res.json();
            setShareToken(data.share_token);
        } catch (err) {
            setError("Failed to generate link. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/share/${shareToken}`
        : "";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Share Conversation</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-purple-600 shadow-sm shrink-0">
                            <Globe size={20} />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900">Public Link</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Anyone with the link can view this conversation.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    {!shareToken ? (
                        <div className="flex justify-center">
                            <button
                                onClick={handlePublish}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-200 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <LinkIcon size={18} />}
                                <span>Create Public Link</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Public Link
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className="p-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors shadow-sm"
                                    title="Copy to clipboard"
                                >
                                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-center text-gray-400">
                                This link allows read-only access to the chat history.
                            </p>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-6 space-y-4">
                        <div className="flex items-center gap-2 text-gray-900 font-medium">
                            <Users size={18} />
                            <h3>Collaborators</h3>
                        </div>

                        {/* Add Collaborator */}
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter Email Address or User ID"
                                    value={newCollaboratorId}
                                    onChange={(e) => setNewCollaboratorId(e.target.value)}
                                    className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 px-1">
                                    Invite by email address for the best experience.
                                </p>
                                <select
                                    value={newCollaboratorRole}
                                    onChange={(e) => setNewCollaboratorRole(e.target.value as "viewer" | "editor")}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none"
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                                <button
                                    onClick={handleAddCollaborator}
                                    disabled={inviteLoading || !newCollaboratorId.trim()}
                                    className="p-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {inviteLoading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Collaborator List */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {collaborators.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2 italic">No collaborators yet.</p>
                            ) : (
                                collaborators.map((collab) => (
                                    <div key={collab.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                                {collab.user_id.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {collab.user_id}
                                                </p>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Shield size={10} />
                                                    <span className="capitalize">{collab.role}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveCollaborator(collab.user_id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Remove access"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
