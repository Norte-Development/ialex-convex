import { Id } from "../convex/_generated/dataModel";

/**
 * Types of case notes for legal case management
 */
export type CaseNoteType =
  | "decisión"
  | "recordatorio"
  | "acuerdo"
  | "información"
  | "otro";

/**
 * Case note interface matching Convex schema
 */
export interface CaseNote {
  _id: Id<"caseNotes">;
  _creationTime: number;
  caseId: Id<"cases">;
  content: string;
  title?: string;
  type: CaseNoteType;
  isImportant: boolean;
  createdBy: Id<"users">;
  updatedBy?: Id<"users">;
  lastEditedAt?: number;
  isActive: boolean;
  // Enriched fields from queries
  creatorName?: string;
  updaterName?: string | null;
}

/**
 * Input for creating a new case note
 */
export interface CreateNoteInput {
  caseId: Id<"cases">;
  content: string;
  title?: string;
  type: CaseNoteType;
  isImportant: boolean;
}

/**
 * Input for updating an existing case note
 */
export interface UpdateNoteInput {
  noteId: Id<"caseNotes">;
  content?: string;
  title?: string;
  type?: CaseNoteType;
  isImportant?: boolean;
}

/**
 * Note type metadata for UI rendering
 */
export interface NoteTypeMetadata {
  value: CaseNoteType;
  label: string;
  color: string;
  description?: string;
}
