import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface UserMentionAutocompleteProps {
  caseId: Id<"cases">;
  input: string;
  cursorPosition: number;
  onSelectUser: (
    user: { id: string; name: string },
    startPos: number,
    endPos: number,
  ) => void;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Parse the current @mention being typed
 */
function parseCurrentMention(
  input: string,
  cursorPos: number,
): { query: string; startPos: number; endPos: number } | null {
  // Find the nearest @ before the cursor
  let atPos = -1;
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (input[i] === "@") {
      atPos = i;
      break;
    }
    // Stop if we hit whitespace
    if (/\s/.test(input[i])) {
      break;
    }
  }

  if (atPos === -1) return null;

  // Extract the text after @
  const textAfterAt = input.slice(atPos + 1, cursorPos);

  // Don't show autocomplete if there's already a completed mention @[...]
  if (textAfterAt.includes("[") || textAfterAt.includes("]")) {
    return null;
  }

  return {
    query: textAfterAt,
    startPos: atPos,
    endPos: cursorPos,
  };
}

export function UserMentionAutocomplete({
  caseId,
  input,
  cursorPosition,
  onSelectUser,
  isVisible,
  onClose,
}: UserMentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current mention
  const currentMention = parseCurrentMention(input, cursorPosition);

  // Get suggestions from backend
  const suggestions = useQuery(
    api.functions.permissions.getCaseMembersSuggestions,
    currentMention && isVisible
      ? {
          caseId,
          query: currentMention.query || undefined,
        }
      : "skip",
  );

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !isVisible ||
        !currentMention ||
        !suggestions ||
        suggestions.length === 0
      )
        return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            handleSelectUser(suggestions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentMention, suggestions, selectedIndex, onClose]);

  const handleSelectUser = (user: { id: string; name: string }) => {
    if (!currentMention) return;
    onSelectUser(user, currentMention.startPos, currentMention.endPos);
  };

  // Don't render if not visible or no suggestions
  if (
    !isVisible ||
    !currentMention ||
    !suggestions ||
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-hidden"
    >
      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-500">Mencionar usuario</span>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {suggestions.map((user, index) => (
          <div
            key={user.id}
            className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors ${
              index === selectedIndex ? "bg-tertiary/10" : "hover:bg-gray-50"
            }`}
            onClick={() => handleSelectUser(user)}
          >
            <div className="w-6 h-6 rounded-full bg-tertiary/20 flex items-center justify-center text-xs font-medium text-tertiary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-1 border-t border-gray-100 bg-gray-50">
        <span className="text-[10px] text-gray-400">
          ↑↓ navegar · ↵ seleccionar · ⎋ cerrar
        </span>
      </div>
    </div>
  );
}
