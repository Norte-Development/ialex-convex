import { useEffect } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Id, TaskStatus } from "../types";

interface UseTaskKanbanMonitorProps {
  onStatusChange: (
    taskId: Id<"todoItems">,
    newStatus: TaskStatus,
  ) => Promise<void>;
  onReorder: (
    taskId: Id<"todoItems">,
    status: TaskStatus,
    targetIndex: number,
    position: "top" | "bottom",
  ) => Promise<void>;
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

        const dropTargets = location.current.dropTargets;
        if (dropTargets.length === 0) return;

        const taskId = source.data.taskId as Id<"todoItems">;
        const oldStatus = source.data.status as TaskStatus;

        // Check if dropped on a task card (for reordering)
        const taskDropTarget = dropTargets.find(
          (target) => target.data.type === "TASK_CARD_DROP",
        );

        // Get the column drop target
        const columnDropTarget = dropTargets.find(
          (target) => target.data.type === "TASK_COLUMN",
        );

        if (taskDropTarget) {
          // Dropped on another task - reorder
          const targetStatus = taskDropTarget.data.status as TaskStatus;
          const targetIndex = taskDropTarget.data.index as number;
          const position = taskDropTarget.data.position as "top" | "bottom";

          if (oldStatus !== targetStatus) {
            // First change status, then reorder
            await onStatusChange(taskId, targetStatus);
          }

          // Reorder within the column
          await onReorder(taskId, targetStatus, targetIndex, position);
        } else if (columnDropTarget) {
          // Dropped on column (not on a task) - just change status
          const newStatus = columnDropTarget.data.status as TaskStatus;
          if (oldStatus !== newStatus) {
            await onStatusChange(taskId, newStatus);
          }
        }
      },
    });
  }, [onStatusChange, onReorder]);
}
