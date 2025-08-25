import { useState } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputButton,
} from "../ai-elements/prompt-input";
import { Square } from "lucide-react";
import type { ChatInputProps } from "./types";
import type { ChatStatus } from "ai";

/**
 * ChatInput Component
 *
 * A modern chat input component built using the ai-sdk elements library.
 * Provides a rich text input experience with support for streaming states,
 * abort functionality, and accessibility features.
 *
 * Features:
 * - Auto-resizing textarea with configurable min/max heights
 * - Submit on Enter (Shift+Enter for new line)
 * - Visual feedback for streaming state
 * - Abort stream functionality
 * - Disabled state management
 * - Keyboard accessibility
 *
 * @component
 * @example
 * ```tsx
 * <ChatInput
 *   onSendMessage={(message) => handleSendMessage(message)}
 *   isStreaming={false}
 *   onAbortStream={() => handleAbortStream()}
 * />
 * ```
 */
export function ChatInput({
  onSendMessage,
  isStreaming,
  onAbortStream,
  placeholder = "¿En qué trabajamos hoy?",
  minHeight = 50,
  maxHeight = 100,
  disabled = false,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");

  /**
   * Handles form submission
   * - Prevents default form behavior
   * - Validates input (non-empty after trim)
   * - Clears input after sending
   * - Calls parent callback with trimmed message
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() === "" || disabled) return;

    const trimmedPrompt = prompt.trim();
    setPrompt(""); // Clear input immediately for better UX
    onSendMessage(trimmedPrompt);
  };

  /**
   * Maps internal streaming state to ai-sdk ChatStatus
   * - 'streaming': Shows stop button and loading indicator
   * - undefined: Shows send button
   */
  const status: ChatStatus | undefined = isStreaming ? "streaming" : undefined;

  // Combined disabled state: prop disabled OR streaming
  const isInputDisabled = disabled || isStreaming;

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {/* 
        PromptInput: Main container component from ai-sdk
        Provides form structure and styling
      */}
      <PromptInput onSubmit={handleSubmit}>
        {/* 
          PromptInputTextarea: Auto-resizing textarea with enhanced features
          - Supports Enter to submit, Shift+Enter for new line
          - Auto-resizes based on content within min/max bounds
        */}
        <PromptInputTextarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          minHeight={minHeight}
          maxHeight={maxHeight}
          disabled={isInputDisabled}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: `${maxHeight}px`,
            height: `${minHeight}px`,
          }}
          className="resize-none !min-h-0"
        />

        {/* 
          PromptInputToolbar: Container for action buttons and controls
          Provides consistent spacing and alignment
        */}
        <PromptInputToolbar>
          {/* 
            PromptInputTools: Left-aligned tool buttons
            Currently shows abort button when streaming
          */}
          <PromptInputTools>
            {isStreaming && (
              <PromptInputButton
                onClick={onAbortStream}
                variant="ghost"
                aria-label="Detener generación"
                disabled={disabled}
              >
                <Square className="w-1 h-1" />
                Detener
              </PromptInputButton>
            )}
          </PromptInputTools>

          {/* 
            PromptInputSubmit: Smart submit button
            - Automatically shows appropriate icon based on status
            - Handles disabled state
            - Provides visual feedback for different states
          */}
          <PromptInputSubmit
            status={status}
            disabled={!prompt.trim() || isInputDisabled}
            aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
            variant={"ghost"}
            size={"sm"}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
