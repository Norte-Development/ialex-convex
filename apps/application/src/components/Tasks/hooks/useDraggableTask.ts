import { useEffect, useRef, useState, useCallback } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const dragHandleElementRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Función para registrar el draggable
  const registerDraggable = useCallback(() => {
    // Limpiar registro anterior
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (isDragDisabled || !elementRef.current) return;

    cleanupRef.current = draggable({
      element: elementRef.current,
      dragHandle: dragHandleElementRef.current ?? undefined,
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

  // Callback ref para el elemento principal
  const setElementRef = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;
      // Re-registrar cuando el elemento cambia
      registerDraggable();
    },
    [registerDraggable],
  );

  // Callback ref para el drag handle
  const setDragHandleRef = useCallback(
    (element: HTMLElement | null) => {
      dragHandleElementRef.current = element;
      // Re-registrar cuando el handle cambia
      if (elementRef.current) {
        registerDraggable();
      }
    },
    [registerDraggable],
  );

  // Re-registrar cuando cambian las props
  useEffect(() => {
    registerDraggable();
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [registerDraggable]);

  return {
    setElementRef,
    setDragHandleRef,
    isDragging,
  };
}
