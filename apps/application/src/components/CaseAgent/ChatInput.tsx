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
import { chatSelectionBus } from "@/lib/chatSelectionBus";
import { SelectionChip } from "./SelectionChip";

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
  minHeight = 40,
  maxHeight = 100,
  disabled = false,
  onReferencesChange,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeReferences, setActiveReferences] = useState<Reference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to selection bus
  useEffect(() => {
    const unsubscribe = chatSelectionBus.subscribe((reference) => {
      setActiveReferences((prev) => {
        // Only one selection at a time: replace existing selection, keep other refs
        const withoutSelection = prev.filter((r) => r.type !== "selection");
        return [...withoutSelection, reference];
      });
    });
    return unsubscribe;
  }, []);

  // Handle focus chat input event from hotkey
  useEffect(() => {
    const handleFocusChatInput = () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    };

    window.addEventListener("ialex:focusChatInput", handleFocusChatInput);
    return () => {
      window.removeEventListener("ialex:focusChatInput", handleFocusChatInput);
    };
  }, []);

  // Notify parent when references change
  useEffect(() => {
    onReferencesChange?.(activeReferences);
  }, [activeReferences, onReferencesChange]);

  const handleRemoveSelection = useCallback(() => {
    setActiveReferences((prev) => prev.filter((r) => r.type !== "selection"));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;

      setPrompt(newValue);
      setCursorPosition(newCursorPos);

      const textBeforeCursor = newValue.slice(0, newCursorPos);
      const hasAtSymbol = /@[a-zA-Z]*:?[a-zA-Z]*$/.test(textBeforeCursor);
      setShowAutocomplete(hasAtSymbol);
    },
    [],
  );

  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) setCursorPosition(textareaRef.current.selectionStart);
  }, []);

  const handleSelectReference = useCallback(
    (reference: any, startPos: number, endPos: number) => {
      const isTypeSelection = reference.name.endsWith(":");

      if (!isTypeSelection) {
        setActiveReferences((prev) => [
          ...prev,
          { type: reference.type, id: reference.id, name: reference.name },
        ]);

        const atPos = prompt.lastIndexOf("@", endPos);
        const newText = prompt.slice(0, atPos) + prompt.slice(endPos);
        const newCursorPos = atPos;

        setPrompt(newText);
        setCursorPosition(newCursorPos);
        setShowAutocomplete(false);

        setTimeout(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }, 0);
      } else {
        const newText = prompt.slice(0, startPos) + reference.name + prompt.slice(endPos);
        const newCursorPos = startPos + reference.name.length;

        setPrompt(newText);
        setCursorPosition(newCursorPos);

        const textBeforeCursor = newText.slice(0, newCursorPos);
        const hasCompleteType = /@(client|document|escrito|case):$/.test(textBeforeCursor);
        setShowAutocomplete(hasCompleteType);

        setTimeout(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }, 0);
      }
    },
    [prompt],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showAutocomplete) return;
    if (prompt.trim() === "" || disabled) return;

    const trimmedPrompt = prompt.trim();

    const referencesText = activeReferences
      .filter((ref) => ref.type !== "selection")
      .map((ref) => `@${ref.type}:${ref.name}`)
      .join(" ");
    const fullMessage = referencesText ? `${referencesText} ${trimmedPrompt}` : trimmedPrompt;

    setPrompt("");
    setActiveReferences([]);
    setShowAutocomplete(false);
    onSendMessage(fullMessage, activeReferences);
  };

  const status: ChatStatus | undefined = isStreaming ? "streaming" : undefined;
  const isInputDisabled = disabled || isStreaming;

  const activeSelection = activeReferences.find((r) => r.type === "selection" && r.selection);

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
    <div className=" p-4 bg-transparent">
      {/* Selection chip on top */}
      {activeSelection?.selection && (
        <div className="mb-2">
          <SelectionChip selection={activeSelection.selection} onRemove={handleRemoveSelection} />
        </div>
      )}

      <div className="relative">
        <PromptInput onSubmit={handleSubmit} className="flex justify-between items-center px-2">
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
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px`, height: `${minHeight}px` }}
            className="resize-none min-h-0! bg-transparent placeholder:text-xs overflow-y-hidden"
          />

          <PromptInputSubmit
            status={status}
            disabled={!isStreaming && (!prompt.trim() || isInputDisabled)}
            aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
            variant={"ghost"}
            size={"sm"}
            type={isStreaming ? "button" : "submit"}
            onClick={handleButtonClick}
            className="bg-transparent disabled:bg-transparent text-black"
          />
        </PromptInput>

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
