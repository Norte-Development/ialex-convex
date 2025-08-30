import { Id } from "../convex/_generated/dataModel";

export interface Folder {
  _id: Id<"folders">;
  _creationTime: number;
  name: string;
  description?: string;
  caseId: Id<"cases">;
  parentFolderId?: Id<"folders">;
  color?: string;
  sortOrder?: number;
  isArchived: boolean;
  createdBy: Id<"users">;
}
