import { Card } from "@/components/ui/card";
import { TaskItem, TaskColumnData } from "../types";
import { KanbanTaskCard } from "./KanbanTaskCard";
import { useDroppableColumn } from "../hooks/useDroppableColumn";

interface KanbanColumnProps {
  column: TaskColumnData;
  tasks: TaskItem[];
  onDeleteTask?: (taskId: string) => void;
}

export function KanbanColumn({ column, tasks, onDeleteTask }: KanbanColumnProps) {
  const { columnRef, isDraggingOver } = useDroppableColumn({
    columnId: column.id,
    status: column.status,
  });

  return (
    <div
      ref={columnRef}
      className={`flex-1 min-w-[300px] max-w-[400px] flex flex-col gap-4 ${
        isDraggingOver ? "scale-105 transition-transform" : ""
      }`}
    >
      {/* Column Header */}
      <Card
        className={`p-4 border-2 ${column.color} ${
          isDraggingOver ? "ring-2 ring-offset-2 ring-blue-500" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{column.title}</h3>
          <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-700">
            {tasks.length}
          </span>
        </div>
      </Card>

      {/* Tasks Container */}
      <div
        className={`flex-1 flex flex-col gap-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto p-2 rounded-lg transition-colors ${
          isDraggingOver
            ? "bg-blue-50 border-2 border-dashed border-blue-300"
            : ""
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-sm text-gray-400 italic">
              No hay tareas en esta columna
            </p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <KanbanTaskCard
              key={task._id}
              task={task}
              index={index}
              onDeleteTask={onDeleteTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
