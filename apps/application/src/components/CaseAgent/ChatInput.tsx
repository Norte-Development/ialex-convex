import { useState, useRef, useCallback, useEffect } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "../ai-elements/prompt-input";
import type { ChatInputProps } from "./types/message-types";
import type { ChatStatus } from "ai";
import { ReferenceAutocomplete } from "./ReferenceAutocomplete";
import type { Reference } from "./types/reference-types";

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
  onReferencesChange,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeReferences, setActiveReferences] = useState<Reference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notify parent when references change
  useEffect(() => {
    if (onReferencesChange) {
      onReferencesChange(activeReferences);
    }
  }, [activeReferences, onReferencesChange]);

  /**
   * Handles input changes and manages autocomplete visibility
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    setPrompt(newValue);
    setCursorPosition(newCursorPos);
    
    // Show autocomplete if we're typing an @ reference
    const textBeforeCursor = newValue.slice(0, newCursorPos);
    const hasAtSymbol = /@[a-zA-Z]*:?[a-zA-Z]*$/.test(textBeforeCursor);
    setShowAutocomplete(hasAtSymbol);
  }, []);

  /**
   * Handles cursor position changes
   */
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  /**
   * Handles reference selection from autocomplete
   */
  const handleSelectReference = useCallback((reference: any, startPos: number, endPos: number) => {
    const isTypeSelection = reference.name.endsWith(':');
    
    if (!isTypeSelection) {
      // Entity selection - add to context bar and remove from input
      setActiveReferences(prev => [...prev, {
        type: reference.type,
        id: reference.id,
        name: reference.name
      }]);
      
      // Remove the entire @reference from input
      const atPos = prompt.lastIndexOf('@', endPos);
      const newText = prompt.slice(0, atPos) + prompt.slice(endPos);
      const newCursorPos = atPos;
      
      setPrompt(newText);
      setCursorPosition(newCursorPos);
      setShowAutocomplete(false);
      
      // Focus back to textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }
      }, 0);
    } else {
      // Type selection - update input and keep autocomplete open
      const newText = prompt.slice(0, startPos) + reference.name + prompt.slice(endPos);
      const newCursorPos = startPos + reference.name.length;
      
      setPrompt(newText);
      setCursorPosition(newCursorPos);
      
      // For type selection, check if we should show entity suggestions
      const textBeforeCursor = newText.slice(0, newCursorPos);
      const hasCompleteType = /@(client|document|escrito|case):$/.test(textBeforeCursor);
      setShowAutocomplete(hasCompleteType);
      
      // Focus back to textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }
      }, 0);
    }
  }, [prompt]);

  /**
   * Handles form submission
   * - Prevents default form behavior
   * - Validates input (non-empty after trim)
   * - Clears input after sending
   * - Calls parent callback with trimmed message
   * - Prevents submission when autocomplete is open
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't submit if autocomplete is showing
    if (showAutocomplete) return;
    
    if (prompt.trim() === "" || disabled) return;

    const trimmedPrompt = prompt.trim();
    
    // Build message with references
    const referencesText = activeReferences.map(ref => `@${ref.type}:${ref.name}`).join(' ');
    const fullMessage = referencesText ? `${referencesText} ${trimmedPrompt}` : trimmedPrompt;
    
    setPrompt(""); // Clear input immediately for better UX
    setActiveReferences([]); // Clear references
    setShowAutocomplete(false);
    onSendMessage(fullMessage);
  };

  /**
   * Maps internal streaming state to ai-sdk ChatStatus
   * - 'streaming': Shows stop button and loading indicator
   * - undefined: Shows send button
   */
  const status: ChatStatus | undefined = isStreaming ? "streaming" : undefined;

  // Combined disabled state: prop disabled OR streaming
  const isInputDisabled = disabled || isStreaming;

  /**
   * Handles button click - either submit or abort based on streaming state
   */
  const handleButtonClick = (e: React.MouseEvent) => {
    if (isStreaming && onAbortStream) {
      e.preventDefault();
      onAbortStream();
    }
    // For non-streaming state, let the form handle submission naturally
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-gray-50">
      {/* 
        PromptInput: Main container component from ai-sdk
        Provides form structure and styling
      */}
      <div className="relative">
        <PromptInput onSubmit={handleSubmit}>
          {/* 
            PromptInputTextarea: Auto-resizing textarea with enhanced features
            - Supports Enter to submit, Shift+Enter for new line
            - Auto-resizes based on content within min/max bounds
          */}
          <PromptInputTextarea
            ref={textareaRef}
            value={prompt}
            onChange={handleInputChange}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
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
          <PromptInputToolbar className=" flex justify-end">
            <PromptInputSubmit
              status={status}
              disabled={!isStreaming && (!prompt.trim() || isInputDisabled)}
              aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
              variant={"ghost"}
              size={"sm"}
              type={isStreaming ? "button" : "submit"}
              onClick={handleButtonClick}
            />
          </PromptInputToolbar>
        </PromptInput>

        {/* Reference Autocomplete */}
        <ReferenceAutocomplete
          input={prompt}
          cursorPosition={cursorPosition}
          onSelectReference={handleSelectReference}
          isVisible={showAutocomplete && !isInputDisabled}
          onClose={() => setShowAutocomplete(false)}
        />
      </div>
    </div>
  );
}
