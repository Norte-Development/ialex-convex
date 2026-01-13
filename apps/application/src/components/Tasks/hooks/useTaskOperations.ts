import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id, TaskItem, TaskStatus } from "../types";

interface GroupedTasks {
  pending: TaskItem[];
  in_progress: TaskItem[];
  completed: TaskItem[];
}

export function useTaskOperations(todoListId: Id<"todoLists">) {
  const updateStatus = useMutation(api.functions.todos.updateTodoItemStatus);
  const reorder = useMutation(api.functions.todos.reorderTodoItems);
  const deleteTask = useMutation(api.functions.todos.deleteTodoItem);

  // Query para obtener todas las tareas de la lista
  const tasks = useQuery(api.functions.todos.listTodoItemsByList, { listId: todoListId });

  // Agrupar y ordenar tareas por status
  const groupedTasks = useMemo<GroupedTasks>(() => {
    if (!tasks) return { pending: [], in_progress: [], completed: [] };

    const pending = tasks
      .filter((t) => t.status === "pending")
      .sort((a, b) => a.order - b.order);

    const inProgress = tasks
      .filter((t) => t.status === "in_progress")
      .sort((a, b) => a.order - b.order);

    const completed = tasks
      .filter((t) => t.status === "completed")
      .sort((a, b) => a.order - b.order);

    return {
      pending,
      in_progress: inProgress,
      completed,
    };
  }, [tasks]);

  const updateTaskStatus = async (taskId: Id<"todoItems">, newStatus: TaskStatus) => {
    await updateStatus({ todoItemId: taskId, newStatus });
  };

  const reorderTasks = async (status: TaskStatus, taskIds: Id<"todoItems">[]) => {
    await reorder({ listId: todoListId, status, taskIds });
  };

  return {
    groupedTasks,
    updateTaskStatus,
    reorderTasks,
    deleteTask,
  };
}
