/**
 * Phase 2 Migration Types
 * 
 * Flat TypeScript interfaces to avoid deep nesting issues.
 * Used with return type annotations instead of validators.
 */

import { Id } from "../_generated/dataModel";

// Firestore source data types
export interface FirestoreCaseData {
  id: string;
  caseName: string;
  description: string | null;
  status: string;
  userId: string; // Kinde user ID
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  documents: Array<string>; // Array of document IDs
  legalDocuments: Array<any>; // Array of legal documents
  sentencias: Array<any>; // Array of sentencias
}

export interface FirestoreClientData {
  id: string;
  nombre: string; // Spanish: name
  email: string | null;
  telefono: string | null; // Spanish: phone
  dni: string | null;
  lugarTrabajo: string | null; // Spanish: workplace
  userId: string; // The Kinde user ID who created this client
}

export interface FirestoreDocumentData {
  id: string;
  fileName: string;
  fileType: string; // "pdf", etc.
  storageUrl: string; // Path in Firebase Storage
  status: string; // "processed", etc.
  date: number; // Timestamp
  userId: string; // Kinde user ID
}

// Operation result types
export interface FileUploadResult {
  success: boolean;
  gcsBucket: string | null;
  gcsObject: string | null;
  error: string | null;
}

export interface ProcessingTriggerResult {
  success: boolean;
  error: string | null;
}

export interface CaseMigrationResult {
  caseId: Id<"cases">;
  oldFirestoreCaseId: string;
}

export interface ClientMigrationResult {
  clientId: Id<"clients">;
  oldFirestoreClientId: string;
}

export interface DocumentMigrationResult {
  documentId: Id<"documents">;
  oldFirestoreDocId: string;
}

export interface LibraryDocumentMigrationResult {
  libraryDocumentId: Id<"libraryDocuments">;
  oldFirestoreDocId: string;
}

export interface UserMigrationResult {
  success: boolean;
  userId: string;
  casesCount: number;
  clientsCount: number;
  documentsCount: number; // Case-linked documents
  libraryDocumentsCount: number; // Standalone library documents
  errorCount: number;
  errors: Array<string>;
}

