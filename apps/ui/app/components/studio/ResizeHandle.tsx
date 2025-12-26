import { FC } from "react";

interface ResizeHandleProps {
    onMouseDown: (e: React.MouseEvent) => void;
    className?: string;
}

const ResizeHandle: FC<ResizeHandleProps> = ({ onMouseDown, className = "" }) => {
    return (
        <div
            onMouseDown={onMouseDown}
            className={`w-1 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 transition-colors z-10 flex items-center justify-center group ${className}`}
        >
            <div className="w-[2px] h-8 bg-gray-200 group-hover:bg-blue-300 rounded-full transition-colors" />
        </div>
    );
};

export default ResizeHandle;
