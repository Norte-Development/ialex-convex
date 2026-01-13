import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, X } from "lucide-react";
import { TaskItem } from "../types";
import { useDraggableTask } from "../hooks/useDraggableTask";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanTaskCardProps {
  task: TaskItem;
  index: number;
  onDeleteTask?: (taskId: string) => void;
}

export function KanbanTaskCard({
  task,
  index,
  onDeleteTask,
}: KanbanTaskCardProps) {
  const updateTodoItem = useMutation(api.functions.todos.updateTodoItem);
  const { taskRef, dragHandleRef, isDragging } = useDraggableTask({
    taskId: task._id,
    status: task.status,
    index,
  });

  const handleStatusToggle = async (checked: boolean) => {
    const newStatus = checked ? "completed" : "pending";
    await updateTodoItem({
      itemId: task._id,
      status: newStatus,
    });
  };

  const handleDelete = () => {
    if (onDeleteTask) {
      onDeleteTask(task._id);
    }
  };

  return (
    <div
      ref={taskRef}
      className={`group flex items-start gap-2 p-3 rounded-md border bg-white transition-all ${
        isDragging
          ? "border-tertiary bg-tertiary/5 shadow-sm"
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      {/* Drag Handle */}
      <span
        ref={dragHandleRef}
        className="flex items-center text-gray-300 cursor-grab active:cursor-grabbing shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={14} />
      </span>

      {/* Checkbox */}
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={handleStatusToggle}
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
      </div>

      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
