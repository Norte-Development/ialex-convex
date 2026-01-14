import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
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

/**
 * Convert display content (@Name) to storage format (@[userId])
 */
function convertToStorageFormat(
  displayContent: string,
  mentionMap: Map<string, string>,
): string {
  let result = displayContent;
  // Sort by name length descending to avoid partial replacements
  const sortedEntries = Array.from(mentionMap.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [name, id] of sortedEntries) {
    // Replace @Name with @[userId] - use word boundary to avoid partial matches
    const regex = new RegExp(`@${escapeRegex(name)}(?=\\s|$|[.,!?;:])`, "g");
    result = result.replace(regex, `@[${id}]`);
  }
  return result;
}

/**
 * Convert storage format (@[userId]) to display format (@Name)
 */
function convertToDisplayFormat(
  storageContent: string,
  members: { id: string; name: string }[] | undefined,
): { display: string; mentionMap: Map<string, string> } {
  const mentionMap = new Map<string, string>();
  let display = storageContent;

  if (!members) return { display, mentionMap };

  const mentionRegex = /@\[([^\]]+)\]/g;
  let match;

  while ((match = mentionRegex.exec(storageContent)) !== null) {
    const userId = match[1];
    const user = members.find((m) => m.id === userId);
    if (user) {
      mentionMap.set(user.name, userId);
    }
  }

  // Replace all @[userId] with @Name
  display = storageContent.replace(mentionRegex, (_, userId) => {
    const user = members.find((m) => m.id === userId);
    return `@${user?.name || "Usuario"}`;
  });

  return { display, mentionMap };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  // mentionMap tracks name -> userId for converting back when sending
  const [mentionMap, setMentionMap] = useState<Map<string, string>>(new Map());
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createComment = useMutation(api.functions.comments.createComment);

  // Get case members for resolving mention names
  const members = useQuery(
    api.functions.permissions.getCaseMembersSuggestions,
    { caseId },
  );

  // Convert initial value from storage format to display format
  const [content, setContent] = useState(() => {
    if (!initialValue) return "";
    // Initial conversion will happen when members load
    return initialValue;
  });

  // Update content when members load and we have initial value with mentions
  const [hasInitialized, setHasInitialized] = useState(false);
  if (members && initialValue && !hasInitialized && /@\[/.test(initialValue)) {
    const { display, mentionMap: newMap } = convertToDisplayFormat(
      initialValue,
      members,
    );
    setContent(display);
    setMentionMap(newMap);
    setHasInitialized(true);
  }

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const newCursorPos = e.target.selectionStart;

      setContent(newValue);
      setCursorPosition(newCursorPos);

      // Check if we should show autocomplete
      const textBeforeCursor = newValue.slice(0, newCursorPos);
      // Show autocomplete if there's an @ followed by word characters (not a completed mention)
      const hasOpenMention = /@[\w]*$/.test(textBeforeCursor);
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
      // Replace @query with @Name (display format)
      const before = content.slice(0, startPos);
      const after = content.slice(endPos);
      const mention = `@${user.name}`;
      const newContent = before + mention + " " + after;
      const newCursorPos = startPos + mention.length + 1;

      // Add to mention map
      setMentionMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(user.name, user.id);
        return newMap;
      });

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

    // Convert display format to storage format before sending
    const storageContent = convertToStorageFormat(content.trim(), mentionMap);

    if (isEditing && onSave) {
      onSave(storageContent);
      return;
    }

    setIsSubmitting(true);
    try {
      await createComment({
        taskId,
        content: storageContent,
      });
      setContent("");
      setMentionMap(new Map());
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
