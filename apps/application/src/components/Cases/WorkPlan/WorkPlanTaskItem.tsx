import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkPlanTaskItemProps {
  itemId: Id<"todoItems">;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

export function WorkPlanTaskItem({ itemId, title, description, status }: WorkPlanTaskItemProps) {
  const updateItem = useMutation(api.functions.todos.updateTodoItem);
  const deleteItem = useMutation(api.functions.todos.deleteTodoItem);

  const isCompleted = status === "completed";

  const handleToggle = () => {
    updateItem({
      itemId,
      status: isCompleted ? "pending" : "completed",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteItem({ itemId });
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 group">
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm block",
            isCompleted && "line-through text-gray-400"
          )}
        >
          {title}
        </span>
        {description && (
          <p className={cn(
            "text-xs text-gray-500 mt-0.5",
            isCompleted && "line-through"
          )}>
            {description}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0"
        onClick={handleDelete}
      >
        <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
      </Button>
    </div>
  );
}
