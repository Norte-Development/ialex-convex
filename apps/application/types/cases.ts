import { Id } from "../convex/_generated/dataModel";

export interface Case {
  _id: Id<"cases">;
  _creationTime: number;
  title: string;
  description?: string;
  status:
    | "pendiente"
    | "en progreso"
    | "completado"
    | "archivado"
    | "cancelado";
  priority: "low" | "medium" | "high";
  category?: string;
  startDate: number;
  endDate?: number;
  assignedLawyer: Id<"users">;
  createdBy: Id<"users">;
  estimatedHours?: number;
  actualHours?: number;
  isArchived: boolean;
  tags?: string[];
  expedientNumber?: string;
  fre?: string;
  lastPjnNotificationSync?: number;
  lastPjnHistorySyncAt?: number;
  // Access control fields (added by getCases query)
  accessLevel?: "basic" | "advanced" | "admin";
  source?: "user" | "team";
}
