import { GripVertical } from "lucide-react";
import type { ResizeHandleProps } from "./types";

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="absolute left-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-10"
      onMouseDown={onMouseDown}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 w-3 h-12 bg-gray-400/40 hover:bg-blue-500 rounded-r-md flex items-center justify-center opacity-50 hover:opacity-100 transition-all shadow-sm group">
        <GripVertical className="w-3 h-3 text-gray-700 group-hover:text-white transition-colors" />
      </div>
    </div>
  );
}
