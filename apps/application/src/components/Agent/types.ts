export interface SidebarChatbotProps {
  isOpen: boolean
  onToggle: () => void
  width: number
  onWidthChange: (width: number) => void
  onResizeStart: () => void
  onResizeEnd: () => void
}

export interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
}

export interface ToggleButtonProps {
  onToggle: () => void
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void
  isStreaming: boolean
  onAbortStream: () => void
} 