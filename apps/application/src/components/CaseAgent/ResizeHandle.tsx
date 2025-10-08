import { GripVertical } from "lucide-react"
import type { ResizeHandleProps } from "./types"

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group"
      onMouseDown={onMouseDown}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-3 h-8 bg-gray-300 hover:bg-blue-500 rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-white" />
      </div>
    </div>
  )
} 