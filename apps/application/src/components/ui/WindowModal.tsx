import { useState } from "react";
import { X, Check, TriangleAlert, Info } from "lucide-react";

interface WindowModalProps {
  title: string;
  description?: string;
  type: "success" | "error" | "info";
}

export default function WindowModal({
  title,
  description,
  type,
}: WindowModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;
  return (
    <div
      className={`w-[534px] border-2 ${type === "success" ? "bg-[#E7FAF5] border-[#B5D0C9]" : type === "error" ? "bg-[#FFE8E8] border-[#E2B6B6]" : "bg-[#EBEEFF] border-secondary"} h-fit relative flex flex-col rounded-[4px] gap-[8px] p-[24px] justify-center items-center `}
    >
      <div className="flex gap-[16px] w-[486px]  justify-center items-center">
        {type === "success" ? (
          <Check size={24} className="text-green-500" />
        ) : type === "error" ? (
          <TriangleAlert size={24} className="text-red-500" />
        ) : (
          <Info size={24} className="text-blue-500" />
        )}
        <p className="text-black text-[20px] font-[500] w-full">{title}</p>
        <X className="cursor-pointer" onClick={() => setIsOpen(false)} />
      </div>
      <p className="w-full pl-[40px] text-[#424242] text-[16px] font-[400]">
        {description}
      </p>
    </div>
  );
}
