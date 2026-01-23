import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import { api } from "../../../../convex/_generated/api";
import { Id, TaskItem, TaskStatus } from "../types";

interface GroupedTasks {
  pending: TaskItem[];
  in_progress: TaskItem[];
  completed: TaskItem[];
}

function groupAndSortTasks(tasks: TaskItem[]): GroupedTasks {
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
}

export function useTaskOperations(todoListId: Id<"todoLists">) {
  const updateStatusMutation = useMutation(
    api.functions.todos.updateTodoItemStatus,
  );
  const reorderMutation = useMutation(api.functions.todos.reorderTodoItems);
  const deleteTask = useMutation(api.functions.todos.deleteTodoItem);

  // Query para obtener todas las tareas de la lista
  const serverTasks = useQuery(api.functions.todos.listTodoItemsByList, {
    listId: todoListId,
  });

  // Estado local para las tareas (para optimistic updates)
  const [localTasks, setLocalTasks] = useState<TaskItem[] | null>(null);

  // Flag para bloquear sincronización durante operaciones
  const isOperatingRef = useRef(false);
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar con el servidor cuando no hay operaciones en curso
  useEffect(() => {
    if (!serverTasks) return;

    // Solo sincronizar si no hay operación en curso
    if (!isOperatingRef.current) {
      setLocalTasks(serverTasks as TaskItem[]);
    }
  }, [serverTasks]);

  // Inicializar localTasks con serverTasks
  useEffect(() => {
    if (serverTasks && localTasks === null) {
      setLocalTasks(serverTasks as TaskItem[]);
    }
  }, [serverTasks, localTasks]);

  // Usar localTasks si existe, sino serverTasks
  const tasks = localTasks ?? serverTasks;

  // Agrupar y ordenar tareas por status
  const groupedTasks = useMemo<GroupedTasks>(() => {
    if (!tasks) return { pending: [], in_progress: [], completed: [] };
    return groupAndSortTasks(tasks as TaskItem[]);
  }, [tasks]);

  const updateTaskStatus = useCallback(
    (taskId: Id<"todoItems">, newStatus: TaskStatus) => {
      if (!localTasks) return;

      // Bloquear sincronización
      isOperatingRef.current = true;
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }

      // Encontrar la tarea actual
      const taskToMove = localTasks.find((t) => t._id === taskId);
      if (!taskToMove) return;

      // Calcular el nuevo orden (al final de la columna destino)
      const tasksInNewStatus = localTasks.filter(
        (t) => t.status === newStatus && t._id !== taskId,
      );
      const newOrder = tasksInNewStatus.length;

      // Aplicar cambio local inmediatamente con flushSync para evitar batching
      flushSync(() => {
        setLocalTasks((prev) => {
          if (!prev) return prev;
          return prev.map((task) =>
            task._id === taskId
              ? { ...task, status: newStatus, order: newOrder }
              : task,
          );
        });
      });

      // Enviar al servidor (sin await para no bloquear)
      updateStatusMutation({ todoItemId: taskId, newStatus })
        .catch((error) => {
          console.error("Error updating status:", error);
          // Revertir en caso de error
          if (serverTasks) {
            setLocalTasks(serverTasks as TaskItem[]);
          }
        })
        .finally(() => {
          // Permitir sincronización después de un delay
          operationTimeoutRef.current = setTimeout(() => {
            isOperatingRef.current = false;
          }, 800);
        });
    },
    [localTasks, serverTasks, updateStatusMutation],
  );

  const reorderTasks = useCallback(
    (status: TaskStatus, taskIds: Id<"todoItems">[]) => {
      if (!localTasks) return;

      // Bloquear sincronización
      isOperatingRef.current = true;
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }

      // Aplicar cambio local inmediatamente con flushSync
      flushSync(() => {
        setLocalTasks((prev) => {
          if (!prev) return prev;
          return prev.map((task) => {
            if (task.status === status) {
              const newOrder = taskIds.indexOf(task._id);
              if (newOrder !== -1) {
                return { ...task, order: newOrder };
              }
            }
            return task;
          });
        });
      });

      // Enviar al servidor (sin await para no bloquear)
      reorderMutation({ listId: todoListId, status, taskIds })
        .catch((error) => {
          console.error("Error reordering:", error);
          // Revertir en caso de error
          if (serverTasks) {
            setLocalTasks(serverTasks as TaskItem[]);
          }
        })
        .finally(() => {
          // Permitir sincronización después de un delay
          operationTimeoutRef.current = setTimeout(() => {
            isOperatingRef.current = false;
          }, 800);
        });
    },
    [localTasks, serverTasks, todoListId, reorderMutation],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
    };
  }, []);

  return {
    groupedTasks,
    updateTaskStatus,
    reorderTasks,
    deleteTask,
    localTasks,
  };
}
