import { Id } from "../convex/_generated/dataModel";

export interface Case {
  _id: Id<"cases">;
  title: string;
  description?: string;
  client: string;
  status: "pendiente" | "en progreso" | "completado" | "archivado" | "cancelado";
  priority: "low" | "medium" | "high";
  category?: string;
  assignedLawyer: Id<"users">;
  createdBy: Id<"users">;
  estimatedHours?: number;
  actualHours?: number;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}