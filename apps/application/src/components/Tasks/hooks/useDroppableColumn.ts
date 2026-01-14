import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { TaskStatus } from "../types";

interface UseDroppableColumnProps {
  columnId: string;
  status: TaskStatus;
}

export function useDroppableColumn({ columnId, status }: UseDroppableColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (!columnRef.current) return;

    return dropTargetForElements({
      element: columnRef.current,
      getData: () => ({
        columnId,
        status,
        type: "TASK_COLUMN",
      }),
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
    });
  }, [columnId, status]);

  return { columnRef, isDraggingOver };
}
