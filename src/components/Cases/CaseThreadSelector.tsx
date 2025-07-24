import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react"
import { useCase } from "@/context/CaseContext"
import { useSetThread } from "@/context/ThreadContext";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";

export function AIAgentThreadSelector() {

  const { caseId } = useCase();
  const setThread = useSetThread();
  const threads = useQuery(api.functions.chat.getThreadMetadata, { caseId: caseId || undefined });

  const { appendMessage } = useCopilotChat();

  const handleThreadClick = (thread: any) => {
    setThread(thread);
  //   appendMessage(
  //     new TextMessage({
  //       content: "<<<loading>>>",
  //       role: Role.System,
  //     }),
  //     { followUp: true }
  // );
  }


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
              onClick={() => handleThreadClick(thread)}
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
