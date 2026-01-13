import type { Id, Doc } from "../../../../convex/_generated/dataModel";
import { useTaskOperations } from "../hooks/useTaskOperations";
import { useTaskKanbanMonitor } from "../hooks/useTaskKanbanMonitor";
import { KanbanColumn } from "./KanbanColumn";
import { TASK_COLUMNS } from "../types";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanBoardProps {
  todoListId: Id<"todoLists">;
}

export function KanbanBoard({ todoListId }: KanbanBoardProps) {
  const { groupedTasks, updateTaskStatus } = useTaskOperations(todoListId);
  const deleteTodoItem = useMutation(api.functions.todos.deleteTodoItem);

  const handleDeleteTask = async (taskId: string) => {
    await deleteTodoItem({ itemId: taskId as Id<"todoItems"> });
  };

  // Setup drag and drop monitor
  useTaskKanbanMonitor({
    onStatusChange: updateTaskStatus,
    onReorder: async () => {
      // Implementar reordenamiento si es necesario
      console.log("Reordenar tarea");
    },
  });

  return (
    <div className="flex gap-6 pb-6 overflow-x-auto">
      {TASK_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={groupedTasks[column.status as keyof typeof groupedTasks]}
          onDeleteTask={handleDeleteTask}
        />
      ))}
    </div>
  );
}
