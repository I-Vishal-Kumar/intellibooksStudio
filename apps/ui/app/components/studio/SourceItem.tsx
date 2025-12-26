import { FC } from "react";
import { FaFileAlt } from "react-icons/fa";

interface SourceItemProps {
    title: string;
}

const SourceItem: FC<SourceItemProps> = ({ title }) => (
    <div className="flex items-center gap-2 border p-2 rounded bg-white hover:bg-gray-50 cursor-pointer">
        <FaFileAlt />
        <span>{title}</span>
    </div>
);

export default SourceItem;
