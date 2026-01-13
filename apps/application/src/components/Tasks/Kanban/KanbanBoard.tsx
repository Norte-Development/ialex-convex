import type { Id } from "../../../../convex/_generated/dataModel";
import { useTaskOperations } from "../hooks/useTaskOperations";
import { useTaskKanbanMonitor } from "../hooks/useTaskKanbanMonitor";
import { KanbanColumn } from "./KanbanColumn";
import { TASK_COLUMNS } from "../types";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanBoardProps {
  todoListId: Id<"todoLists">;
  caseId: Id<"cases">;
}

export function KanbanBoard({ todoListId, caseId }: KanbanBoardProps) {
  const { groupedTasks, updateTaskStatus } = useTaskOperations(todoListId);
  const deleteTodoItem = useMutation(api.functions.todos.deleteTodoItem);

  const handleDeleteTask = async (taskId: string) => {
    await deleteTodoItem({ itemId: taskId as Id<"todoItems"> });
  };

  useTaskKanbanMonitor({
    onStatusChange: updateTaskStatus,
    onReorder: async () => {
      console.log("Reordenar tarea");
    },
  });

  return (
    <div className="flex gap-8 pb-4 overflow-x-auto">
      {TASK_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={groupedTasks[column.status as keyof typeof groupedTasks]}
          onDeleteTask={handleDeleteTask}
          caseId={caseId}
        />
      ))}
    </div>
  );
}
