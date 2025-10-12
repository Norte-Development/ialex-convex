// Export types
export type { LegislationSearchResult } from './types';

// Export client
export { client } from './client';
export { default } from './client';

// Export case document functions
export {
  searchCaseDocumentsWithClustering,
  getDocumentChunkByIndex,
  getDocumentChunksByRange,
  searchDocumentChunks,
  getDocumentChunkCount,
  deleteDocumentChunks,
} from './caseDocuments';

// Export library document functions
export {
  searchLibraryDocumentsWithClustering,
  getLibraryDocumentChunkByIndex,
  getLibraryDocumentChunksByRange,
  searchLibraryDocumentChunks,
  getLibraryDocumentChunkCount,
  deleteLibraryDocumentChunksFromQdrant,
} from './libraryDocuments';

// Export legislation functions
export { searchNormatives } from './legislation';
