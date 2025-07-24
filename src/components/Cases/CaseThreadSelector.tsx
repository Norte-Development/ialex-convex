import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react"
import { useCase } from "@/context/CaseContext"
import { useSetThread } from "@/context/ThreadContext";

export function AIAgentThreadSelector() {

  const { caseId } = useCase();
  const setThread = useSetThread();
  const threads = useQuery(api.functions.chat.getThreadMetadata, { caseId: caseId || undefined });


  return (
    <div className="flex flex-col">
      {/* Thread List */}
      <div className="flex flex-col">
        {threads?.map((thread) => (
          <div
            key={thread._id}
            className={`
              px-3 py-2.5 cursor-pointer transition-colors border-b border-border/20 last:border-b-0
              hover:bg-accent/50
              ${thread.isActive ? "bg-accent" : ""}
            `}
            onClick={() => setThread({
              threadId: thread.threadId || "",
              title: thread.title || "",
              agentType: thread.agentType || "",
              isActive: thread.isActive,
              _id: thread._id,
            })}
          >
            <div className="flex items-center justify-between">
              <span
                className={`
                  text-sm font-medium truncate
                  ${thread.isActive ? "text-foreground" : "text-foreground/80"}
                `}
              >
                {thread.title}
              </span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">{thread._creationTime}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
