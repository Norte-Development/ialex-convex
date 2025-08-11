import { MessageCircle, X } from "lucide-react"

interface SidebarHeaderProps {
  onToggle: () => void
}

export function SidebarHeader({ onToggle }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-gray-800">Alex - Tu agente legal</h2>
      </div>
      <button onClick={onToggle} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
        <X className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  )
} 