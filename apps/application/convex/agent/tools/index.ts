// Export all tools
export { editEscritoTool } from './editEscritoTool';
export { getEscritoTool } from './getEscritoTool';
export { searchFallosTool } from './searchFallosTool';
export { searchCaseDocumentsTool } from './searchCaseDocumentsTool';
export { readDocumentTool } from './readDocumentTool';
export { queryDocumentTool } from './queryDocumentTool';
export { listCaseDocumentsTool } from './listCaseDocumentsTool';

// Export validation helpers
export { validateEditType, validateMarkType, validateParagraphType } from './validation';


// Export all tools as an array for convenience
import { editEscritoTool } from './editEscritoTool';
import { getEscritoTool } from './getEscritoTool';
import { searchFallosTool } from './searchFallosTool';
import { searchCaseDocumentsTool } from './searchCaseDocumentsTool';
import { readDocumentTool } from './readDocumentTool';
import { queryDocumentTool } from './queryDocumentTool';
import { listCaseDocumentsTool } from './listCaseDocumentsTool';

export const allTools = [
  editEscritoTool,
  getEscritoTool,
  searchFallosTool,
  searchCaseDocumentsTool,
  readDocumentTool,
  queryDocumentTool,
  listCaseDocumentsTool,
];
