import { Id, Doc } from "../../../convex/_generated/dataModel";

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface TaskItem extends Doc<"todoItems"> {
  _id: Id<"todoItems">;
  listId: Id<"todoLists">;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;
  assignedTo?: Id<"users">;
  dueDate?: number;
  createdBy: Id<"users">;
}

export interface TaskColumnData {
  id: string;
  title: string;
  status: TaskStatus;
  color: string;
}

export const TASK_COLUMNS: TaskColumnData[] = [
  { id: "pending", title: "Pendiente", status: "pending", color: "bg-gray-100 border-gray-300" },
  { id: "in_progress", title: "En Progreso", status: "in_progress", color: "bg-blue-100 border-blue-300" },
  { id: "completed", title: "Completado", status: "completed", color: "bg-green-100 border-green-300" },
];

export interface DragDataTaskCard {
  type: "TASK_CARD";
  taskId: Id<"todoItems">;
  status: TaskStatus;
  index: number;
}

export interface DragDataTaskColumn {
  type: "TASK_COLUMN";
  columnId: string;
  status: TaskStatus;
}
