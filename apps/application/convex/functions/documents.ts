// ========================================
// DOCUMENTS MODULE - RE-EXPORTS
// This file maintains backward compatibility by re-exporting
// all functions from the new documentManagement directory structure.
// ========================================

// Document Storage
export {
  generateUploadUrl,
  getDocumentUrl,
} from "./documentManagement/documentStorage";

// Document CRUD Operations
export {
  createDocument,
  internalCreateDocument,
  deleteDocument,
  moveDocument,
} from "./documentManagement/documentCrud";

// Document Queries
export {
  getDocuments,
  getDocumentsInFolder,
  getAllDocumentsInFolder,
  getDocument,
  getDocumentTranscription,
} from "./documentManagement/documentQueries";

// Escritos CRUD Operations
export {
  createEscrito,
  createEscritoWithContent,
  updateEscrito,
  archiveEscrito,
} from "./documentManagement/escritosCrud";

// Escritos Queries
export {
  getEscritos,
  getEscrito,
  internalGetEscrito,
  getArchivedEscritos,
  searchEscritos,
  getRecentEscritos,
  resolveEscritoId,
  getEscritosWithPendingChanges,
} from "./documentManagement/escritosQueries";

// Agent Helpers (internal)
export {
  getDocumentForAgent,
  getDocumentsForAgent,
} from "./documentManagement/documentAgentHelpers";

export {
  getEscritosForAgent,
} from "./documentManagement/escritosAgentHelpers";
