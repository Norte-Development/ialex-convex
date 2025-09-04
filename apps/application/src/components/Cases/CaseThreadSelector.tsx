import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";
import { useMemo } from "react";

export function AIAgentThreadSelector({
  searchTerm = "",
}: {
  searchTerm?: string;
}) {
  const { threadId, setThreadId } = useThread();
  const { caseId } = useCase();
  // Get threads from Convex agent (not the old chat system)
  const threads = useQuery(api.agent.threads.listThreads, {
    paginationOpts: { numItems: 50, cursor: null as any },
    caseId: caseId || undefined,
  });

  const items = threads?.page ?? [];
  const filteredThreads = useMemo(() => {
    const q = (searchTerm ?? "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((thread) =>
      (thread.title || "Untitled Thread").toLowerCase().includes(q),
    );
  }, [items, searchTerm]);

  return (
    <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Thread List */}
      <div className="flex flex-col">
        {filteredThreads.map((thread) => (
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
