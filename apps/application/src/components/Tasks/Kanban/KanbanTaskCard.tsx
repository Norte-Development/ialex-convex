import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Trash2 } from "lucide-react";
import { TaskItem } from "../types";
import { useDraggableTask } from "../hooks/useDraggableTask";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanTaskCardProps {
  task: TaskItem;
  index: number;
  onDelete?: (taskId: string) => void;
}

export function KanbanTaskCard({ task, index, onDelete }: KanbanTaskCardProps) {
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
    if (onDelete) {
      onDelete(task._id);
    }
  };

  return (
    <Card
      ref={taskRef}
      className={`transition-all duration-200 ${
        isDragging
          ? "bg-blue-100/80 border-blue-300 opacity-80 shadow-lg rotate-2 scale-105"
          : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag Handle */}
        <span
          ref={dragHandleRef}
          className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing shrink-0 mt-1"
          aria-label="Arrastrar tarea"
          title="Arrastrar tarea"
        >
          <GripVertical size={16} />
        </span>

        {/* Checkbox */}
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={handleStatusToggle}
          className="shrink-0 mt-1"
        />

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium text-sm ${
              task.status === "completed"
                ? "line-through text-gray-400"
                : "text-gray-900"
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
          aria-label="Eliminar tarea"
          title="Eliminar tarea"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}
