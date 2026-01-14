import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ArrowRight, Circle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface WorkPlanQuickAccessProps {
  caseId: Id<"cases">;
  className?: string;
}

export function WorkPlanQuickAccess({
  caseId,
  className,
}: WorkPlanQuickAccessProps) {
  const lists = useQuery(api.functions.todos.listTodoListsByCase, { caseId });
  const primaryList = useMemo(() => lists?.[0], [lists]);
  const items = useQuery(
    api.functions.todos.listTodoItemsByList,
    primaryList ? { listId: primaryList._id } : "skip",
  );

  // Filtrar tareas pendientes
  const pendingTasks = useMemo(() => {
    if (!items) return [];
    return items
      .filter((i) => i.status === "pending" || i.status === "in_progress")
      .sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (a.status !== "in_progress" && b.status === "in_progress") return 1;
        return a.order - b.order;
      })
      .slice(0, 3);
  }, [items]);

  const totalPending =
    items?.filter((i) => i.status === "pending" || i.status === "in_progress")
      .length || 0;

  // Sin tareas pendientes - no mostrar nada
  if (totalPending === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Tareas pendientes</h3>
        <Link
          to={`/caso/${caseId}/tareas`}
          className="text-xs text-tertiary hover:underline flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1">
        {pendingTasks.map((task) => (
          <Link
            key={task._id}
            to={`/caso/${caseId}/tareas`}
            className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded px-2 -mx-2 transition-colors group"
          >
            {task.status === "in_progress" ? (
              <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
            )}
            <span className="text-sm text-gray-600 group-hover:text-gray-900 truncate">
              {task.title}
            </span>
          </Link>
        ))}
        {totalPending > 3 && (
          <Link
            to={`/caso/${caseId}/tareas`}
            className="text-xs text-gray-400 hover:text-tertiary pl-5"
          >
            +{totalPending - 3} más
          </Link>
        )}
      </div>
    </div>
  );
}
