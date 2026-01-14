import { useRef, useState, useCallback, useEffect } from "react";
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
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(
    null,
  );
  const elementRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Función para registrar el drop target
  const registerDropTarget = useCallback(() => {
    // Limpiar registro anterior
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!elementRef.current) return;

    cleanupRef.current = dropTargetForElements({
      element: elementRef.current,
      getData: ({ input }) => {
        const element = elementRef.current;
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

  // Callback ref para el elemento
  const setElementRef = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;
      registerDropTarget();
    },
    [registerDropTarget],
  );

  // Re-registrar cuando cambian las props
  useEffect(() => {
    registerDropTarget();
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [registerDropTarget]);

  return { setElementRef, isDraggedOver, dropPosition };
}
