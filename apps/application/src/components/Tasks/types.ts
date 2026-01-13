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
  {
    id: "pending",
    title: "Pendiente",
    status: "pending",
    color: "border-gray-200",
  },
  {
    id: "in_progress",
    title: "En Progreso",
    status: "in_progress",
    color: "border-tertiary",
  },
  {
    id: "completed",
    title: "Completado",
    status: "completed",
    color: "border-gray-200",
  },
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
