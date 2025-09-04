import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";

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
  const items = threads?.page ?? [];

  return (
    <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Thread List */}
      <div className="flex flex-col">
        {items.length === 0 && (
          <div className="px-3 py-2.5 cursor-pointer transition-colors border-b border-border/20 last:border-b-0">
            No tenes historial de chat con ({searchTerm}) / Proba con otro
            termino
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
          </div>
        ))}
      </div>
    </div>
  );
}
