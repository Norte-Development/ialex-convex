import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";

// Extend the thread type to include search properties
type ThreadWithSearch = {
  _creationTime: number;
  _id: string;
  status: "active" | "archived";
  summary?: string | undefined;
  title?: string | undefined;
  userId?: string | undefined;
  searchSnippet?: string;
  matchType?: "title" | "content";
};

// Function to highlight search term in text
const highlightSearchTerm = (text: string, searchTerm: string) => {
  if (!searchTerm.trim()) return text;

  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchTerm.toLowerCase()) {
      return (
        <mark
          key={index}
          className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
};

export function AIAgentThreadSelector({
  searchTerm = "",
}: {
  searchTerm?: string;
}) {
  const { threadId, setThreadId } = useThread();
  const { caseId } = useCase();

  const hasSearchTerm = searchTerm.trim().length > 0;

  // Use search function when there's a search term, otherwise use regular list
  const searchResults = useQuery(
    api.agent.threads.searchThreads,
    hasSearchTerm
      ? {
          searchTerm: searchTerm.trim(),
          caseId: caseId || undefined,
        }
      : "skip",
  );

  const listResults = useQuery(
    api.agent.threads.listThreads,
    !hasSearchTerm
      ? {
          paginationOpts: { numItems: 50, cursor: null as any },
          caseId: caseId || undefined,
        }
      : "skip",
  );

  const threads = hasSearchTerm ? searchResults : listResults;
  const items = (threads?.page ?? []) as ThreadWithSearch[];

  return (
    <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Thread List */}
      <div className="flex flex-col">
        {items.length === 0 && hasSearchTerm && (
          <div className="px-3 py-2.5 text-muted-foreground text-xs">
            No hay threads que contengan "{searchTerm}"
          </div>
        )}
        {items.map((thread) => (
          <div
            key={thread._id}
            className={`
              px-3 py-2.5 cursor-pointer transition-colors border-b border-border/20 last:border-b-0
              hover:bg-accent/50
              ${thread._id === threadId ? "bg-accent" : ""}
            `}
            onClick={(e) => {
              e.stopPropagation();
              setThreadId(thread._id);
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span
                  className={`
                    text-sm font-medium truncate
                    ${thread._id === threadId ? "text-foreground" : "text-foreground/80"}
                  `}
                >
                  {thread.title || "Untitled Thread"}
                </span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {new Date(thread._creationTime).toLocaleDateString()}
                </span>
              </div>

              {/* Show snippet only when searching and there's a content match */}
              {hasSearchTerm &&
                thread.searchSnippet &&
                thread.matchType === "content" && (
                  <div className="bg-accent/30 rounded-md px-3 py-2 border-l-2 border-primary/40">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Contenido
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-foreground/70 leading-relaxed line-clamp-3">
                      {highlightSearchTerm(
                        thread.searchSnippet,
                        searchTerm.trim(),
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
