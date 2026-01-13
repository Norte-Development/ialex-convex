import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { UserMentionAutocomplete } from "./UserMentionAutocomplete";

interface CommentInputProps {
  taskId: Id<"todoItems">;
  caseId: Id<"cases">;
  onCommentAdded?: () => void;
  initialValue?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  onSave?: (content: string) => void;
  placeholder?: string;
}

export function CommentInput({
  taskId,
  caseId,
  onCommentAdded,
  initialValue = "",
  isEditing = false,
  onCancel,
  onSave,
  placeholder = "Escribe un comentario... usa @ para mencionar",
}: CommentInputProps) {
  const [content, setContent] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createComment = useMutation(api.functions.comments.createComment);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;

      setContent(newValue);
      setCursorPosition(newCursorPos);

      // Check if we should show autocomplete
      const textBeforeCursor = newValue.slice(0, newCursorPos);
      // Show autocomplete if there's an @ that's not part of a completed mention @[...]
      const hasOpenMention = /@[^@\[\]\s]*$/.test(textBeforeCursor);
      setShowAutocomplete(hasOpenMention);
    },
    [],
  );

  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  const handleSelectUser = useCallback(
    (user: { id: string; name: string }, startPos: number, endPos: number) => {
      // Replace @query with @[userId] and add the name as display text after
      const before = content.slice(0, startPos);
      const after = content.slice(endPos);
      const mention = `@[${user.id}]`;
      const newContent = before + mention + after;
      const newCursorPos = startPos + mention.length;

      setContent(newContent);
      setCursorPosition(newCursorPos);
      setShowAutocomplete(false);

      // Refocus textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [content],
  );

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    if (isEditing && onSave) {
      onSave(content.trim());
      return;
    }

    setIsSubmitting(true);
    try {
      await createComment({
        taskId,
        content: content.trim(),
      });
      setContent("");
      onCommentAdded?.();
    } catch (error) {
      console.error("Failed to create comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit if autocomplete is open
    if (showAutocomplete) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    if (e.key === "Escape" && isEditing && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInputChange}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-tertiary focus:border-tertiary min-h-[38px] max-h-[120px]"
            style={{ height: "auto" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <UserMentionAutocomplete
            caseId={caseId}
            input={content}
            cursorPosition={cursorPosition}
            onSelectUser={handleSelectUser}
            isVisible={showAutocomplete}
            onClose={() => setShowAutocomplete(false)}
          />
        </div>
        <div className="flex items-end gap-1">
          {isEditing && onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-gray-500"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="bg-tertiary hover:bg-tertiary/90"
          >
            {isEditing ? "Guardar" : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
