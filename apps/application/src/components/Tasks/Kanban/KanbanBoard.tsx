import type { Id } from "../../../../convex/_generated/dataModel";
import { useTaskOperations } from "../hooks/useTaskOperations";
import { useTaskKanbanMonitor } from "../hooks/useTaskKanbanMonitor";
import { KanbanColumn } from "./KanbanColumn";
import { TASK_COLUMNS, TaskStatus } from "../types";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanBoardProps {
  todoListId: Id<"todoLists">;
  caseId: Id<"cases">;
}

export function KanbanBoard({ todoListId, caseId }: KanbanBoardProps) {
  const { groupedTasks, updateTaskStatus, reorderTasks, localTasks } =
    useTaskOperations(todoListId);
  const deleteTodoItem = useMutation(api.functions.todos.deleteTodoItem);

  const handleDeleteTask = async (taskId: string) => {
    await deleteTodoItem({ itemId: taskId as Id<"todoItems"> });
  };

  const handleReorder = (
    taskId: Id<"todoItems">,
    status: TaskStatus,
    targetIndex: number,
    position: "top" | "bottom",
  ) => {
    // Usar localTasks para obtener el estado actual real
    if (!localTasks) return;

    // Obtener tareas de la columna destino desde localTasks
    const tasksInColumn = localTasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);

    const taskIds = tasksInColumn.map((t) => t._id);

    // Find current position of the dragged task in this column
    const currentIndex = taskIds.indexOf(taskId);

    // Calculate new position
    let newIndex = position === "top" ? targetIndex : targetIndex + 1;

    // If moving down in the same column, adjust for removal
    if (currentIndex !== -1 && currentIndex < newIndex) {
      newIndex--;
    }

    // Remove task from current position if it's in this column
    const filteredIds = taskIds.filter((id) => id !== taskId);

    // Insert at new position
    filteredIds.splice(newIndex, 0, taskId);

    // Call reorder (synchronously applies optimistic update)
    reorderTasks(status, filteredIds);
  };

  useTaskKanbanMonitor({
    onStatusChange: updateTaskStatus,
    onReorder: handleReorder,
  });

  return (
    <div className="flex gap-8 pb-4 overflow-x-auto">
      {TASK_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={groupedTasks[column.status as keyof typeof groupedTasks]}
          onDeleteTask={handleDeleteTask}
          onStatusChange={updateTaskStatus}
          caseId={caseId}
        />
      ))}
    </div>
  );
}
