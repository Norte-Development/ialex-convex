export interface ChunkingConfig {
  maxTokens: number;
  overlapRatio: number;
  pageWindow: number;
}

interface BaseJobPayload {
  signedUrl: string;
  contentType?: string;
  originalFileName?: string;
  callbackUrl: string;
  hmacSecret?: string;
  chunking?: ChunkingConfig;
  fileBuffer?: Buffer | Uint8Array;
}

export interface CaseJobPayload extends BaseJobPayload {
  jobType?: "case-document";
  tenantId: string;
  createdBy?: string;
  caseId: string;
  documentId: string;
  documentType?: string;
}

export interface LibraryJobPayload extends BaseJobPayload {
  jobType?: "library-document";
  createdBy: string;
  libraryDocumentId: string;
  userId?: string;
  teamId?: string;
  folderId?: string;
  documentType?: string;
}

export type JobPayload = CaseJobPayload | LibraryJobPayload;

