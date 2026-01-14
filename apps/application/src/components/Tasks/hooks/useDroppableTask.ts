import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Id, TaskStatus } from "../types";

interface UseDroppableTaskProps {
  taskId: Id<"todoItems">;
  status: TaskStatus;
  index: number;
}

export function useDroppableTask({
  taskId,
  status,
  index,
}: UseDroppableTaskProps) {
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(
    null,
  );

  useEffect(() => {
    if (!dropRef.current) return;

    return dropTargetForElements({
      element: dropRef.current,
      getData: ({ input }) => {
        const element = dropRef.current;
        if (!element) return { taskId, status, index, type: "TASK_CARD_DROP" };

        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = input.clientY < midY ? "top" : "bottom";

        return {
          taskId,
          status,
          index,
          position,
          type: "TASK_CARD_DROP",
        };
      },
      canDrop: ({ source }) => {
        // Don't allow dropping on itself
        return source.data.taskId !== taskId;
      },
      onDragEnter: ({ self }) => {
        setIsDraggedOver(true);
        setDropPosition(self.data.position as "top" | "bottom");
      },
      onDrag: ({ self }) => {
        setDropPosition(self.data.position as "top" | "bottom");
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
        setDropPosition(null);
      },
      onDrop: () => {
        setIsDraggedOver(false);
        setDropPosition(null);
      },
    });
  }, [taskId, status, index]);

  return { dropRef, isDraggedOver, dropPosition };
}
