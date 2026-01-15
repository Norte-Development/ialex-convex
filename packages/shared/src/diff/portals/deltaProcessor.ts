import { applyJsonDelta } from './deltaApplier';
import { handleArrayDelta } from './arrayChanges';

/**
 * Processes the JSON diff delta to create change nodes
 * @param oldDoc - The original document
 * @param newDoc - The modified document
 * @param delta - The diff delta
 * @param changeId - Base change ID for tracking
 * @returns Processed document with change nodes
 */
export function processJsonDiffDelta(oldDoc: any, newDoc: any, delta: any, changeId: string): any {
  // Start with new document structure
  const result = JSON.parse(JSON.stringify(newDoc));
  
  // Apply delta changes to create change nodes
  applyJsonDelta(result, oldDoc, delta, changeId, [], handleArrayDelta);
  
  return result;
}
export { handleValueDelta } from './deltaValueHandlers';