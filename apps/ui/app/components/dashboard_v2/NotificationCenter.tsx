import { FC, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, MessageSquare, ExternalLink, Check } from "lucide-react";

interface Notification {
    id: string;
    type: string;
    title: string;
    content: string;
    link: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationCenterProps {
    currentUserId: string;
}

const NotificationCenter: FC<NotificationCenterProps> = ({ currentUserId }) => {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        if (!currentUserId || currentUserId === "anonymous") return;
        console.log(`[NotificationCenter] Fetching for ${currentUserId}...`);
        try {
            const res = await fetch("http://localhost:8004/api/notifications/", {
                headers: { "X-User-Id": currentUserId }
            });
            console.log(`[NotificationCenter] Status: ${res.status}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [currentUserId]);

    const markAsRead = async (id: string) => {
        try {
            await fetch(`http://localhost:8004/api/notifications/${id}/read`, {
                method: "POST",
                headers: { "X-User-Id": currentUserId }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error("Failed to mark as read:", err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Bell size={16} />
                                Notifications
                            </h3>
                            <span className="text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                                {unreadCount} New
                            </span>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center bg-white">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                                        <Bell size={24} />
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                                    <p className="text-xs text-gray-400 mt-1">We'll alert you here for new activity</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer group relative ${!notif.is_read ? 'bg-purple-50/30' : ''}`}
                                            onClick={() => {
                                                if (!notif.is_read) markAsRead(notif.id);
                                                router.push(notif.link);
                                                setIsOpen(false);
                                            }}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notif.type === 'invite' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    <MessageSquare size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'} truncate`}>
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                        {notif.content}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            {new Date(notif.created_at).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            View Chat <ExternalLink size={10} />
                                                        </span>
                                                    </div>
                                                </div>
                                                {!notif.is_read && (
                                                    <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
                                <button
                                    className="text-xs text-gray-500 hover:text-purple-600 font-medium transition-colors"
                                    onClick={() => { /* Handle clear all? */ }}
                                >
                                    Dismiss all notifications
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;
