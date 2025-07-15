import { CHANGE_TYPES } from './types';
import { handleTextDelta } from './textDiff';
import { detectFormattingChanges, createFormattingDiff } from './formattingChanges';
import { applyJsonDelta } from './deltaUtils';

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
  applyJsonDelta(result, oldDoc, delta, changeId, []);
  
  return result;
}

/**
 * Handles value-specific delta changes (property additions, modifications, deletions)
 * @param newNode - The new node to modify
 * @param key - The property key
 * @param change - The change array
 * @param baseChangeId - Base change ID
 * @param path - Current path in the document tree
 */
export function handleValueDelta(
  newNode: any,
  key: string,
  change: any[],
  baseChangeId: string,
  path: string[]
): void {
  const changeId = `${baseChangeId}-${path.join('-')}-${key}`;
  
  if (change.length === 1) {
    // Addition: [newValue] - but check for content formatting changes first
    if (key === 'content' && Array.isArray(change[0])) {
      const newContent = change[0];
      const oldContent = newNode[key] || [];
      
      // Check if this is a formatting change in content array
      if (detectFormattingChanges(oldContent, newContent)) {
        // Create formatting diff
        const formattingDiff = createFormattingDiff(oldContent, newContent, changeId);
        newNode[key] = formattingDiff;
        return;
      }
    }
    
    // Regular addition
    handlePropertyAddition(newNode, key, change[0]);
  } else if (change.length === 2) {
    // Modification: [oldValue, newValue]
    handlePropertyModification(newNode, key, change[0], change[1], changeId);
  } else if (change.length === 3 && change[1] === 0 && change[2] === 0) {
    // Deletion: [oldValue, 0, 0]
    handlePropertyDeletion(newNode, key, change[0], changeId);
  }
}

/**
 * Handles property addition
 * @param newNode - The node to modify
 * @param key - The property key
 * @param newValue - The new value
 */
export function handlePropertyAddition(newNode: any, key: string, newValue: any): void {
  newNode[key] = newValue;
}

/**
 * Handles property modification
 * @param newNode - The node to modify
 * @param key - The property key
 * @param oldValue - The old value
 * @param newValue - The new value
 * @param changeId - The change ID
 */
export function handlePropertyModification(
  newNode: any,
  key: string,
  oldValue: any,
  newValue: any,
  changeId: string
): void {
  if (key === 'text' && newNode.type === 'text') {
    // Handle text node modifications specially
    handleTextDelta(newNode, oldValue, newValue, changeId);
  } else {
    // For other properties, replace the value and store metadata
    newNode[key] = newValue;
    newNode[`__change_${key}`] = {
      type: CHANGE_TYPES.MODIFIED,
      old: oldValue,
      new: newValue,
      changeId
    };
  }
}

/**
 * Handles property deletion
 * @param newNode - The node to modify
 * @param key - The property key
 * @param oldValue - The old value
 * @param changeId - The change ID
 */
export function handlePropertyDeletion(newNode: any, key: string, oldValue: any, changeId: string): void {
  if (key === 'content' && Array.isArray(oldValue)) {
    // Handle content array deletion by creating change nodes
    handleContentArrayDeletion(newNode, key, oldValue, changeId);
  } else {
    // For other deletions, remove the property and store metadata
    delete newNode[key];
    newNode[`__deleted_${key}`] = {
      type: CHANGE_TYPES.DELETED,
      old: oldValue,
      changeId
    };
  }
}

/**
 * Handles deletion of content arrays by creating change nodes
 * @param newNode - The node to modify
 * @param key - The property key
 * @param deletedContent - The deleted content array
 * @param changeId - The change ID
 */
export function handleContentArrayDeletion(
  newNode: any,
  key: string,
  deletedContent: any[],
  changeId: string
): void {
  // For content deletions, we don't add deleted content to the new node
  // Instead, we store deletion metadata for tracking purposes
  newNode[`__deleted_${key}`] = {
    type: CHANGE_TYPES.DELETED,
    old: deletedContent,
    changeId,
    deletedItems: deletedContent.map((item: any, index: number) => ({
      item,
      changeId: `${changeId}-item-${index}`
    }))
  };
  
  // If the new node doesn't have content, ensure it stays empty
  if (!newNode[key]) {
    newNode[key] = [];
  }
  // Don't add deleted content to the current node - this was the bug
}