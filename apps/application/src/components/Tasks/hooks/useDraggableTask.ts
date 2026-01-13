import { useEffect, useRef, useState } from "react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Id, TaskStatus } from "../types";

interface UseDraggableTaskProps {
  taskId: Id<"todoItems">;
  status: TaskStatus;
  index: number;
  isDragDisabled?: boolean;
}

export function useDraggableTask({
  taskId,
  status,
  index,
  isDragDisabled = false,
}: UseDraggableTaskProps) {
  const taskRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isDragDisabled || !taskRef.current) return;

    return draggable({
      element: taskRef.current,
      dragHandle: dragHandleRef.current ?? undefined,
      getInitialData: () => ({
        taskId,
        status,
        index,
        type: "TASK_CARD",
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [taskId, status, index, isDragDisabled]);

  return { taskRef, dragHandleRef, isDragging };
}
