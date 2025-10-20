import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useThread } from "@/context/ThreadContext";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

type TodoPanelProps = {
  className?: string;
};

export function TodoPanel({ className }: TodoPanelProps) {
  const { threadId } = useThread();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const lists = useQuery(
    api.functions.todos.listTodoListsByThread,
    threadId ? { threadId } : "skip",
  );

  const listId = useMemo(() => lists?.[0]?._id, [lists]);
  const items = useQuery(
    api.functions.todos.listTodoItemsByList,
    listId ? { listId } : "skip",
  );

  const updateItem = useMutation(api.functions.todos.updateTodoItem);

  if (!threadId) return null;

  return (
    <div className={cn("border-t bg-transparent px-2", className)}>
      <div
        className="flex items-center justify-between gap-2  cursor-pointer bg-[#F4F7FC] py-4 px-5 rounded-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Brain className="text-gray-500 shrink-0" size={16} />
          <span className="text-xs font-semibold text-gray-600 truncate">
            {lists && lists.length > 0 ? lists[0].title : "Plan actual"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lists && lists.length > 0 && (
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              {lists[0].progressPercent ?? 0}% completo
            </span>
          )}
          {isCollapsed ? (
            <ChevronRight className="text-gray-500" size={16} />
          ) : (
            <ChevronDown className="text-gray-500" size={16} />
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className="space-y-1 bg-[#F4F7FC] px-3">
          {(items ?? []).map((it: any) => (
            <label
              key={it._id}
              className="flex  items-center gap-2 text-[12px]"
            >
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={it.status === "completed"}
                onChange={() => {
                  void updateItem({
                    itemId: it._id as any,
                    status: it.status === "completed" ? "pending" : "completed",
                  });
                }}
              />
              <span
                className={cn(
                  "truncate",
                  it.status === "completed" && "line-through text-gray-400",
                )}
              >
                {it.title}
              </span>
            </label>
          ))}
          {items && items.length === 0 && (
            <div className="text-[12px] text-gray-500">Sin tareas aún.</div>
          )}
        </div>
      )}
    </div>
  );
}
