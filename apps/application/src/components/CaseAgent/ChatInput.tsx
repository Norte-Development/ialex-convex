import { useState, useRef, useCallback, useEffect } from "react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
} from "../ai-elements/prompt-input";
import type { ChatInputProps } from "./types/message-types";
import type { ChatStatus } from "ai";
import { ReferenceAutocomplete } from "./ReferenceAutocomplete";
import type { Reference } from "./types/reference-types";
import { chatSelectionBus } from "@/lib/chatSelectionBus";
import { SelectionChip } from "./SelectionChip";
import { useChatbot } from "@/context/ChatbotContext";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  maxHeight = 250,
  disabled = false,
  onReferencesChange,
  initialPrompt,
  onInitialPromptProcessed,
  webSearchEnabled = false,
  onWebSearchToggle,
}: ChatInputProps) {
  const { currentPrompt: persistedPrompt, setCurrentPrompt } = useChatbot();
  // Initialize with persisted prompt, but initialPrompt takes precedence
  const [prompt, setPrompt] = useState(() => {
    // If there's an initialPrompt, use it; otherwise use persisted prompt
    return initialPrompt || persistedPrompt || "";
  });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeReferences, setActiveReferences] = useState<Reference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialPromptProcessedRef = useRef(false);
  const previousInitialPromptRef = useRef<string | undefined>(undefined);

  // Handle initialPrompt changes (takes precedence over persisted prompt)
  useEffect(() => {
    // Only process if initialPrompt exists, hasn't been processed yet, and is different from previous
    const isNewPrompt =
      initialPrompt &&
      initialPrompt !== previousInitialPromptRef.current &&
      !initialPromptProcessedRef.current;

    if (isNewPrompt) {
      setPrompt(initialPrompt);
      setCurrentPrompt(initialPrompt); // Also persist the initial prompt
      initialPromptProcessedRef.current = true;
      previousInitialPromptRef.current = initialPrompt;

      // Notify parent that prompt has been processed
      onInitialPromptProcessed?.();

      // Focus the textarea after setting the prompt
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            initialPrompt.length,
            initialPrompt.length,
          );
        }
      }, 0);
    } else if (initialPrompt !== previousInitialPromptRef.current) {
      // If initialPrompt changed to a different value, reset the processed flag
      // This allows processing a new prompt even if the previous one was already processed
      initialPromptProcessedRef.current = false;
      previousInitialPromptRef.current = initialPrompt;
    }
  }, [initialPrompt, onInitialPromptProcessed, setCurrentPrompt]);

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
      setCurrentPrompt(newValue); // Persist to context
      setCursorPosition(newCursorPos);

      const textBeforeCursor = newValue.slice(0, newCursorPos);
      const hasAtSymbol = /@[a-zA-Z]*:?[a-zA-Z]*$/.test(textBeforeCursor);
      setShowAutocomplete(hasAtSymbol);
    },
    [setCurrentPrompt],
  );

  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current)
      setCursorPosition(textareaRef.current.selectionStart);
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
        setCurrentPrompt(newText); // Persist to context
        setCursorPosition(newCursorPos);
        setShowAutocomplete(false);

        setTimeout(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }, 0);
      } else {
        const newText =
          prompt.slice(0, startPos) + reference.name + prompt.slice(endPos);
        const newCursorPos = startPos + reference.name.length;

        setPrompt(newText);
        setCurrentPrompt(newText); // Persist to context
        setCursorPosition(newCursorPos);

        const textBeforeCursor = newText.slice(0, newCursorPos);
        const hasCompleteType = /@(client|document|escrito|case):$/.test(
          textBeforeCursor,
        );
        setShowAutocomplete(hasCompleteType);

        setTimeout(() => {
          if (!textareaRef.current) return;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }, 0);
      }
    },
    [prompt, setCurrentPrompt],
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
    const fullMessage = referencesText
      ? `${referencesText} ${trimmedPrompt}`
      : trimmedPrompt;

    setPrompt("");
    setCurrentPrompt(""); // Clear persisted prompt when message is sent
    setActiveReferences([]);
    setShowAutocomplete(false);
    onSendMessage(fullMessage, activeReferences);
  };

  const status: ChatStatus | undefined = isStreaming ? "streaming" : undefined;
  const isInputDisabled = disabled || isStreaming;

  const activeSelection = activeReferences.find(
    (r) => r.type === "selection" && r.selection,
  );

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
      <div className="relative">
        <PromptInput
          onSubmit={handleSubmit}
          className="border border-input rounded-xl shadow-sm bg-background overflow-hidden"
        >
          {/* Active Selection within input area */}
          {activeSelection?.selection && (
            <div className="px-3 pt-3 pb-0">
              <SelectionChip
                selection={activeSelection.selection}
                onRemove={handleRemoveSelection}
                className="bg-muted/50 border-0 shadow-none rounded-md text-muted-foreground"
              />
            </div>
          )}

          {/* 
            PromptInputTextarea: Auto-resizing textarea with enhanced features
            - Supports Enter to submit, Shift+Enter for new line
            - Auto-resizes based on content within min/max bounds
            - Scrollable when content exceeds max height
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
            }}
            className={cn(
              "resize-none min-h-[40px] bg-transparent placeholder:text-xs overflow-y-auto border-0 focus-visible:ring-0 shadow-none px-3 py-3",
              activeSelection?.selection && "pt-2"
            )}
          />

          <PromptInputToolbar className="flex justify-between items-center p-2 border-t bg-muted/10">
            <PromptInputTools>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PromptInputButton
                    onClick={() => onWebSearchToggle?.(!webSearchEnabled)}
                    variant={webSearchEnabled ? "secondary" : "ghost"}
                    className={cn(
                      "rounded-full transition-all h-8 w-8",
                      webSearchEnabled &&
                        "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    )}
                    size="icon"
                    type="button"
                  >
                    <Globe className="size-4" />
                    <span className="sr-only">Toggle Web Search</span>
                  </PromptInputButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Búsqueda web {webSearchEnabled ? "activada" : "desactivada"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </PromptInputTools>

            <PromptInputSubmit
              status={status}
              disabled={!isStreaming && (!prompt.trim() || isInputDisabled)}
              aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
              variant={"default"}
              size={"icon"}
              type={isStreaming ? "button" : "submit"}
              onClick={handleButtonClick}
              className="h-8 w-8 rounded-full"
            />
          </PromptInputToolbar>
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
