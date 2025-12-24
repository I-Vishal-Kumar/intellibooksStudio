import { Share2, Settings, Grid3X3, Plus } from "lucide-react";
import NotificationCenter from "./NotificationCenter";

interface HeaderProps {
    title?: string;
    onCreateNotebook?: () => void;
    onShare?: () => void;
    currentUserId?: string;
}

const Header: FC<HeaderProps> = ({
    title = "jAI Enterprise Agent Characteristics Framework",
    onCreateNotebook,
    onShare,
    currentUserId
}) => {
    return (
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl leading-none">j</span>
                </div>
                <h1 className="text-xl font-medium text-gray-800 truncate max-w-[500px]">{title}</h1>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onCreateNotebook}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full font-medium hover:bg-gray-800 transition-colors"
                >
                    <Plus size={18} />
                    Create notebook
                </button>

                <button
                    onClick={onShare}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                >
                    <Share2 size={18} />
                    <span className="text-sm font-medium">Share</span>
                </button>

                <NotificationCenter currentUserId={currentUserId || ""} />

                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1">
                    <Settings size={18} />
                    <span className="text-sm font-medium">Settings</span>
                </button>

                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Grid3X3 size={18} />
                </button>

                <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    A
                </div>
            </div>
        </header>
    );
};

export default Header;
