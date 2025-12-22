import { FC } from "react";

interface StudioButtonProps {
    title: string;
}

const StudioButton: FC<StudioButtonProps> = ({ title }) => (
    <button className="border-boder-red-500 rounded p-2 text-sm hover:bg-gray-100">{title}</button>
);

export default StudioButton;
