import { MessageCircle } from "lucide-react"
import type { ToggleButtonProps } from "./types"

export function ToggleButton({ onToggle }: ToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-6 right-6 z-30 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  )
} 