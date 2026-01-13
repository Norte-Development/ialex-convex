import { useEffect } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Id, TaskStatus } from "../types";

interface UseTaskKanbanMonitorProps {
  onStatusChange: (taskId: Id<"todoItems">, newStatus: TaskStatus) => Promise<void>;
  onReorder: (status: TaskStatus, taskIds: Id<"todoItems">[]) => Promise<void>;
}

export function useTaskKanbanMonitor({
  onStatusChange,
  onReorder,
}: UseTaskKanbanMonitorProps) {
  useEffect(() => {
    return monitorForElements({
      onDragStart: () => {
        try {
          document.body.classList.add("overflow-x-hidden");
        } catch {}
      },
      onDrop: async ({ source, location }) => {
        try {
          document.body.classList.remove("overflow-x-hidden");
        } catch {}

        if (source.data.type !== "TASK_CARD") return;

        const dropTarget = location.current.dropTargets[0];
        if (!dropTarget) return;

        const taskId = source.data.taskId as Id<"todoItems">;
        const oldStatus = source.data.status as TaskStatus;
        const newStatus = dropTarget.data.status as TaskStatus;

        // Caso 1: Cambiar de columna (cambiar status)
        if (oldStatus !== newStatus) {
          await onStatusChange(taskId, newStatus);
          return;
        }

        // Caso 2: Reordenar dentro de la misma columna
        // Nota: Para implementar reordenamiento dentro de la misma columna,
        // necesitaríamos detectar la posición específica donde se soltó la tarea.
        // Esto requiere lógica adicional con hitbox entre tareas.
        // Por ahora, el reordenamiento se puede hacer moviendo a otra columna y volviendo.
        // Una implementación completa usaría pointers de drag & drop más avanzados.
      },
    });
  }, [onStatusChange, onReorder]);
}
