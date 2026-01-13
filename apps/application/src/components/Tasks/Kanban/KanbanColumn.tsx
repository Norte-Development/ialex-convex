import { TaskItem, TaskColumnData } from "../types";
import { KanbanTaskCard } from "./KanbanTaskCard";
import { useDroppableColumn } from "../hooks/useDroppableColumn";

interface KanbanColumnProps {
  column: TaskColumnData;
  tasks: TaskItem[];
  onDeleteTask?: (taskId: string) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onDeleteTask,
}: KanbanColumnProps) {
  const { columnRef, isDraggingOver } = useDroppableColumn({
    columnId: column.id,
    status: column.status,
  });

  return (
    <div
      ref={columnRef}
      className="flex-1 min-w-[280px] max-w-[350px] flex flex-col"
    >
      {/* Column Header */}
      <div className={`pb-3 border-b-2 ${column.color} mb-3`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">{column.title}</h3>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </div>
      </div>

      {/* Tasks Container */}
      <div
        className={`flex-1 flex flex-col gap-2 min-h-[300px] max-h-[calc(100vh-280px)] overflow-y-auto transition-colors rounded-lg p-1 ${
          isDraggingOver ? "bg-tertiary/5" : ""
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-gray-300">Sin tareas</p>
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
