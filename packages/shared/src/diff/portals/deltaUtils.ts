import { handleArrayDelta } from './arrayChanges';
import { handleValueDelta } from './deltaProcessor';

/**
 * Recursively applies JSON delta changes to create change nodes
 * @param newNode - The new node to modify
 * @param oldNode - The original node for comparison
 * @param delta - The diff delta for this level
 * @param changeId - Base change ID
 * @param path - Current path in the document tree
 */
export function applyJsonDelta(
  newNode: any,
  oldNode: any,
  delta: any,
  changeId: string,
  path: string[] = []
): void {
  if (!delta || typeof delta !== 'object') return;
  
  // Handle direct array changes
  if (delta._t === 'a') {
    handleArrayDelta(newNode, oldNode, delta, changeId, path);
    return;
  }
  
  // Process each property change
  for (const key in delta) {
    if (key === '_t') continue; // Skip array type marker
    
    const change = delta[key];
    
    if (Array.isArray(change)) {
      // Simple value change: [oldValue, newValue] or [newValue] for addition
      handleValueDelta(newNode, key, change, changeId, path);
    } else if (typeof change === 'object' && change !== null) {
      if (change._t === 'a') {
        // Array change for this property
        handleArrayDelta(newNode, oldNode, change, changeId, [...path, key]);
      } else {
        // Nested object changes
        if (newNode[key] && oldNode && oldNode[key]) {
          applyJsonDelta(newNode[key], oldNode[key], change, changeId, [...path, key]);
        }
      }
    }
  }
}