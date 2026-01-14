import { useState, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, X, MessageSquare } from "lucide-react";
import { TaskItem } from "../types";
import { useDraggableTask } from "../hooks/useDraggableTask";
import { useDroppableTask } from "../hooks/useDroppableTask";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { TaskDetailDialog } from "../TaskDetailDialog";
import type { Id } from "../../../../convex/_generated/dataModel";

interface KanbanTaskCardProps {
  task: TaskItem;
  index: number;
  onDeleteTask?: (taskId: string) => void;
  onStatusChange?: (
    taskId: Id<"todoItems">,
    newStatus: "pending" | "completed",
  ) => void;
  caseId: Id<"cases">;
}

export function KanbanTaskCard({
  task,
  index,
  onDeleteTask,
  onStatusChange,
  caseId,
}: KanbanTaskCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const {
    setElementRef: setDragElementRef,
    setDragHandleRef,
    isDragging,
  } = useDraggableTask({
    taskId: task._id,
    status: task.status,
    index,
  });

  const {
    setElementRef: setDropElementRef,
    isDraggedOver,
    dropPosition,
  } = useDroppableTask({
    taskId: task._id,
    status: task.status,
    index,
  });

  // Combinar los callback refs
  const setCombinedRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDragElementRef(element);
      setDropElementRef(element);
    },
    [setDragElementRef, setDropElementRef],
  );

  // Get comment count
  const commentCount = useQuery(api.functions.comments.getCommentCount, {
    taskId: task._id,
  });

  const handleStatusToggle = async (checked: boolean) => {
    const newStatus = checked ? "completed" : "pending";
    if (onStatusChange) {
      onStatusChange(task._id, newStatus);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteTask) {
      onDeleteTask(task._id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open dialog if clicking on checkbox, drag handle, or delete button
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("[data-state]") ||
      target.closest("[data-drag-handle]")
    ) {
      return;
    }
    setIsDetailOpen(true);
  };

  return (
    <>
      <div className="relative">
        {/* Drop indicator - top */}
        {isDraggedOver && dropPosition === "top" && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-tertiary -translate-y-1 rounded-full" />
        )}
        <div
          ref={setCombinedRef}
          onClick={handleCardClick}
          className={`group flex items-start gap-2 p-3 rounded-md border bg-white transition-all cursor-pointer ${
            isDragging
              ? "border-tertiary bg-tertiary/5 shadow-sm opacity-50"
              : "border-gray-100 hover:border-gray-200"
          }`}
        >
          {/* Drag Handle */}
          <span
            ref={setDragHandleRef}
            data-drag-handle
            className="flex items-center text-gray-300 cursor-grab active:cursor-grabbing shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical size={14} />
          </span>

          {/* Checkbox */}
          <Checkbox
            checked={task.status === "completed"}
            onCheckedChange={handleStatusToggle}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 mt-0.5 border-gray-300 data-[state=checked]:bg-tertiary data-[state=checked]:border-tertiary"
          />

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${
                task.status === "completed"
                  ? "line-through text-gray-400"
                  : "text-gray-700"
              }`}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                {task.description}
              </p>
            )}
            {/* Comment count indicator */}
            {commentCount !== undefined && commentCount > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-gray-400">
                <MessageSquare size={12} />
                <span className="text-xs">{commentCount}</span>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
        {/* Drop indicator - bottom */}
        {isDraggedOver && dropPosition === "bottom" && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-tertiary translate-y-1 rounded-full" />
        )}
      </div>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        task={task}
        caseId={caseId}
      />
    </>
  );
}
