import { useState } from "react"
import { Send, Square } from "lucide-react"
import type { ChatInputProps } from "./types"

export function ChatInput({ onSendMessage, isStreaming, onAbortStream }: ChatInputProps) {
  const [prompt, setPrompt] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() === "") return
    
    const trimmedPrompt = prompt.trim()
    setPrompt("")
    onSendMessage(trimmedPrompt)
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          placeholder="¿En que trabajamos hoy?"
        />
        {isStreaming ? (
          <button
            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            onClick={onAbortStream}
            type="button"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!prompt.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  )
} 