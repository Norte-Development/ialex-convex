import { CHANGE_TYPES } from './types';
import { createChangeNode } from './nodeChanges';
import { createTextDiff, handleTextDelta } from './textDiff';
import {  normalizeText } from './utils';
import { detectFormattingChanges, createFormattingDiff } from './formattingChanges';
import { applyJsonDelta } from './deltaUtils';

/**
 * Normalizes text for comparison by removing extra whitespace and converting to lowercase
 * @param text - Text to normalize
 * @returns Normalized text
 */
function normalizeTextForComparison(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Extracts normalized text content from a node for comparison
 * @param node - Node to extract text from
 * @returns Normalized text content
 */
function extractNormalizedText(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text') {
    return normalizeTextForComparison(node.text || '');
  }
  
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNormalizedText).join('');
  }
  
  return '';
}

/**
 * Checks if two nodes are content-equivalent (same content, regardless of position)
 * @param node1 - First node to compare
 * @param node2 - Second node to compare
 * @returns True if nodes have equivalent content
 */
function areNodesContentEquivalent(node1: any, node2: any): boolean {
  if (!node1 || !node2) return false;
  
  // Must be same type
  if (node1.type !== node2.type) return false;
  
  // For text nodes, compare normalized text and marks
  if (node1.type === 'text') {
    const text1 = normalizeTextForComparison(node1.text || '');
    const text2 = normalizeTextForComparison(node2.text || '');
    const marks1 = JSON.stringify(node1.marks || []);
    const marks2 = JSON.stringify(node2.marks || []);
    
    return text1 === text2 && marks1 === marks2;
  }
  
  // For paragraphs and other block nodes, compare normalized text content first
  if (node1.type === 'paragraph' || node1.type === 'heading' || node1.type === 'blockquote') {
    const text1 = extractNormalizedText(node1);
    const text2 = extractNormalizedText(node2);
    
    // If text content is different, they're definitely not equivalent
    if (text1 !== text2) return false;
    
    // If text is the same, compare attributes (but be more lenient)
    const attrs1 = JSON.stringify(node1.attrs || {});
    const attrs2 = JSON.stringify(node2.attrs || {});
    if (attrs1 !== attrs2) return false;
    
    // If text and attributes match, consider them equivalent regardless of internal structure
    return true;
  }
  
  // For other node types, compare attributes first
  const attrs1 = JSON.stringify(node1.attrs || {});
  const attrs2 = JSON.stringify(node2.attrs || {});
  if (attrs1 !== attrs2) return false;
  
  // For nodes with content, compare content arrays
  if (node1.content || node2.content) {
    const content1 = node1.content || [];
    const content2 = node2.content || [];
    
    if (content1.length !== content2.length) return false;
    
    // Recursively compare all content items
    for (let i = 0; i < content1.length; i++) {
      if (!areNodesContentEquivalent(content1[i], content2[i])) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Checks if two paragraphs have the same structure but different text content
 * @param oldParagraph - Original paragraph node  
 * @param newParagraph - Modified paragraph node
 * @returns True if same structure but different text
 */
function isParagraphTextModification(oldParagraph: any, newParagraph: any): boolean {
  if (!oldParagraph || !newParagraph) return false;
  if (oldParagraph.type !== 'paragraph' || newParagraph.type !== 'paragraph') return false;
  
  // Check if attributes are the same
  const oldAttrs = JSON.stringify(oldParagraph.attrs || {});
  const newAttrs = JSON.stringify(newParagraph.attrs || {});
  if (oldAttrs !== newAttrs) return false;
  
  const oldContent = oldParagraph.content || [];
  const newContent = newParagraph.content || [];
  
  // Must have same number of content nodes
  if (oldContent.length !== newContent.length) return false;
  
  let hasTextChange = false;
  
  // Check each content node
  for (let i = 0; i < oldContent.length; i++) {
    const oldNode = oldContent[i];
    const newNode = newContent[i];
    
    // Must be same type
    if (oldNode.type !== newNode.type) return false;
    
    // For text nodes, check if marks are the same but text is different
    if (oldNode.type === 'text') {
      const oldMarks = JSON.stringify(oldNode.marks || []);
      const newMarks = JSON.stringify(newNode.marks || []);
      
      // Marks must be the same
      if (oldMarks !== newMarks) return false;
      
      // If text is different, this is a text modification
      if (oldNode.text !== newNode.text) {
        hasTextChange = true;
      }
    } else {
      // For non-text nodes, they must be identical
      if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) return false;
    }
  }
  
  return hasTextChange;
}

/**
 * Creates inline text changes for a paragraph text modification
 * @param oldParagraph - Original paragraph
 * @param newParagraph - Modified paragraph  
 * @param changeId - Change ID to use
 * @returns Array of change nodes (deleted + added) for the paragraph
 */
function createParagraphTextChanges(oldParagraph: any, newParagraph: any, changeId: string): any[] {
  const result: any[] = [];
  
  const oldContent = oldParagraph.content || [];
  const newContent = newParagraph.content || [];
  
  // Process each content node to create inline changes
  for (let i = 0; i < Math.max(oldContent.length, newContent.length); i++) {
    const oldNode = oldContent[i];
    const newNode = newContent[i];
    
    if (oldNode && newNode && 
        oldNode.type === 'text' && newNode.type === 'text' && 
        oldNode.text !== newNode.text) {
      
      // Create deleted node (original text)
      const deletedNode = {
        type: 'inlineChange',
        attrs: {
          changeType: 'deleted',
          changeId: changeId,
          semanticType: 'text_change'
        },
        content: [
          {
            type: 'text',
            marks: oldNode.marks || [],
            text: oldNode.text
          }
        ]
      };
      
      // Create added node (new text)
      const addedNode = {
        type: 'inlineChange',
        attrs: {
          changeType: 'added',
          changeId: changeId,
          semanticType: 'text_change'
        },
        content: [
          {
            type: 'text',
            marks: newNode.marks || [],
            text: newNode.text
          }
        ]
      };
      
      result.push(deletedNode);
      result.push(addedNode);
      
    } else if (oldNode && newNode) {
      // Unchanged content
      result.push(newNode);
    } else if (newNode) {
      // Added content
      result.push(newNode);
    }
    // Skip deleted content (oldNode without newNode) as it's handled above
  }
  
  // If no changes were detected, return the original paragraph structure
  if (result.length === 0) {
    return [newParagraph];
  }
  
  // Wrap the result in a paragraph structure
  return [{
    type: 'paragraph',
    attrs: newParagraph.attrs || {},
    content: result
  }];
}

/**
 * Calculates a reasonable search window for matching moved content
 * @param totalLength - Total length of the array
 * @param changeIndex - Index of the change
 * @returns Object with search start and end indices
 */
function getSearchWindow(totalLength: number, changeIndex: number): {start: number, end: number} {
  // Search within a window that grows with document size but has reasonable limits
  const windowSize = Math.min(Math.max(20, Math.floor(totalLength * 0.1)), 50);
  const start = Math.max(0, changeIndex - windowSize);
  const end = Math.min(totalLength, changeIndex + windowSize);
  
  return { start, end };
}

/**
 * Scores how likely two indices represent a move vs a real change
 * @param fromIndex - Original index
 * @param toIndex - New index
 * @param totalChanges - Total number of changes detected
 * @returns Similarity score (higher = more likely to be a move)
 */
function getMoveScore(fromIndex: number, toIndex: number, totalChanges: number): number {
  const distance = Math.abs(toIndex - fromIndex);
  
  // Closer moves are more likely to be position shifts
  let proximityScore = Math.max(0, 100 - distance * 2);
  
  // If there are many changes, be more aggressive about filtering
  if (totalChanges > 10) {
    proximityScore *= 1.5;
  }
  
  // Exact matches get a boost
  if (distance === 0) {
    proximityScore += 50;
  }
  
  return Math.min(100, proximityScore);
}

/**
 * Detects and filters out false positive changes where content just shifted position
 * @param additions - Map of additions by index
 * @param deletions - Map of deletions by index  
 * @returns Object with filtered additions and deletions, plus detected moves
 */
function filterFalsePositiveChanges(
  additions: Map<number, any>, 
  deletions: Map<number, any>
): {
  filteredAdditions: Map<number, any>,
  filteredDeletions: Map<number, any>,
  detectedMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}>
} {
  const filteredAdditions = new Map(additions);
  const filteredDeletions = new Map(deletions);
  const detectedMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
  
  const totalChanges = additions.size + deletions.size;
  const maxIndex = Math.max(
    ...Array.from(additions.keys()),
    ...Array.from(deletions.keys()),
    0
  );
  
  // Find potential moves with position-aware scoring
  const potentialMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
  
  for (const [deletionIndex, deletedContent] of deletions) {
    const searchWindow = getSearchWindow(maxIndex + 1, deletionIndex);
    
    for (const [additionIndex, addedContent] of additions) {
      // Only consider additions within reasonable proximity
      if (additionIndex >= searchWindow.start && additionIndex <= searchWindow.end) {
        if (areNodesContentEquivalent(deletedContent, addedContent)) {
          const score = getMoveScore(deletionIndex, additionIndex, totalChanges);
          
          potentialMoves.push({
            fromIndex: deletionIndex,
            toIndex: additionIndex,
            content: deletedContent,
            score
          });
        }
      }
    }
  }
  
  // Determine thresholds based on the magnitude of changes
  let scoreThreshold = 40;
  
  // If we detect many changes, be more aggressive about filtering
  // This suggests a large-scale false positive scenario
  if (totalChanges > 20) {
    scoreThreshold = 30; // Lower threshold = more aggressive filtering
  } else if (totalChanges > 50) {
    scoreThreshold = 20; // Very aggressive for mass changes
  }
  
  // Sort by score (highest first) and apply moves above threshold
  potentialMoves
    .sort((a, b) => b.score - a.score)
    .forEach(move => {
      // Apply moves with sufficient confidence scores
      if (move.score >= scoreThreshold && 
          filteredDeletions.has(move.fromIndex) && 
          filteredAdditions.has(move.toIndex)) {
        
        detectedMoves.push(move);
        filteredDeletions.delete(move.fromIndex);
        filteredAdditions.delete(move.toIndex);
      }
    });
  
  // Final pass: Check for remaining patterns that might be false positives
  // Look for consecutive index pairs that might be insertions causing shifts
  const remainingDeletions = Array.from(filteredDeletions.entries()).sort((a, b) => a[0] - b[0]);
  const remainingAdditions = Array.from(filteredAdditions.entries()).sort((a, b) => a[0] - b[0]);
  
  // If we still have many remaining changes after filtering, and they show a pattern
  // of consecutive indices, it's likely still false positives from content shifting
  if (remainingDeletions.length > 5 && remainingAdditions.length > 5) {
    const additionalMoves: Array<{fromIndex: number, toIndex: number, content: any, score: number}> = [];
    
    for (let i = 0; i < remainingDeletions.length; i++) {
      const [delIndex, delContent] = remainingDeletions[i];
      
      // Look for matching content in remaining additions, even if not perfectly positioned
      for (let j = 0; j < remainingAdditions.length; j++) {
        const [addIndex, addContent] = remainingAdditions[j];
        
        if (areNodesContentEquivalent(delContent, addContent)) {
          // If content matches and we haven't already processed this pair
          const alreadyProcessed = additionalMoves.some(m => 
            m.fromIndex === delIndex || m.toIndex === addIndex);
          
          if (!alreadyProcessed) {
            additionalMoves.push({
              fromIndex: delIndex,
              toIndex: addIndex,
              content: delContent,
              score: 25 // Lower score for this fallback matching
            });
            break;
          }
        }
      }
    }
    
    // Apply additional moves if we found many (suggesting systematic false positives)
    if (additionalMoves.length >= 3) {
      additionalMoves.forEach(move => {
        if (filteredDeletions.has(move.fromIndex) && filteredAdditions.has(move.toIndex)) {
          detectedMoves.push(move);
          filteredDeletions.delete(move.fromIndex);
          filteredAdditions.delete(move.toIndex);
        }
      });
    }
  }
  
  return { filteredAdditions, filteredDeletions, detectedMoves };
}

/**
 * Handles array-specific delta changes (additions, deletions, modifications)
 * @param newNode - The new node containing the array
 * @param oldNode - The original node for comparison
 * @param delta - The array delta
 * @param baseChangeId - Base change ID
 * @param path - Current path in the document tree
 */
export function handleArrayDelta(
    newNode: any,
    oldNode: any,
    delta: any,
    baseChangeId: string,
    path: string[]
  ): void {
    const arrayKey = path[path.length - 1] || 'content';
    const newArray = newNode[arrayKey] || [];
    const oldArray = oldNode[arrayKey] || [];
    
    // Categorize changes by type, including formatting changes
    const changesByType = categorizeArrayChanges(delta, oldArray);
    
    // Build result array with change nodes
    const resultArray = buildArrayWithChanges(
      newArray,
      oldArray,
      changesByType,
      baseChangeId,
      path
    );
    
    // Update the array in the node
    newNode[arrayKey] = resultArray;
  }

/**
 * Categorizes array changes into additions, deletions, modifications, and formatting changes
 * @param delta - The array delta
 * @param oldArray - The original array for comparison
 * @param newArray - The new array for comparison
 * @returns Object containing categorized changes
 */
export function categorizeArrayChanges(delta: any, oldArray: any[] = []) {
    const additions = new Map<number, any>();
    const deletions = new Map<number, any>();
    const nestedChanges = new Map<number, any>();
    const formattingChanges = new Map<number, { oldContent: any[], newContent: any[] }>();
    
    // First pass: collect all deletions and additions
    for (const key in delta) {
      if (key === '_t') continue;
      
      const change = delta[key];
      
      if (key.startsWith('_')) {
        // Deletion: key starts with underscore
        const index = parseInt(key.substring(1));
        if (Array.isArray(change) && change.length === 3 && change[1] === 0 && change[2] === 0) {
          deletions.set(index, change[0]);
        }
      } else {
        // Addition or nested change
        const index = parseInt(key);
        
        if (Array.isArray(change) && change.length === 1) {
          // Potential addition: [newValue] - but check for formatting changes first
          const newContent = change[0];
          const oldContent = oldArray[index];
          
          // Check if this is a formatting change (same text, different structure)
          if (oldContent && newContent && 
              oldContent.type === 'paragraph' && newContent.type === 'paragraph' &&
              oldContent.content && newContent.content &&
              detectFormattingChanges(oldContent.content, newContent.content)) {
            
            formattingChanges.set(index, {
              oldContent: oldContent.content,
              newContent: newContent.content
            });
          } else {
            // Regular addition
            additions.set(index, newContent);
          }
        } else if (typeof change === 'object' && change !== null) {
          // Nested changes within array item
          nestedChanges.set(index, change);
        }
      }
    }
    
    // Store original counts for debugging
    const originalAdditions = additions.size;
    const originalDeletions = deletions.size;
    
    // Track which indices are converted to paragraph text changes
    const paragraphTextChangeIndices = new Set<number>();
    
    // First, check for paragraph text modifications before filtering moves
    const paragraphTextChanges = new Map<string, { oldParagraph: any, newParagraph: any, changeId: string }>();
    
    // Look for deletion+addition pairs that are paragraph text modifications
    for (const [deletionIndex, deletedContent] of deletions) {
      for (const [additionIndex, addedContent] of additions) {
        if (isParagraphTextModification(deletedContent, addedContent)) {
          const changeId = `paragraph-text-${Math.random().toString(36).substr(2, 9)}`;
          
          paragraphTextChanges.set(`${deletionIndex}-${additionIndex}`, {
            oldParagraph: deletedContent,
            newParagraph: addedContent,
            changeId
          });
          
          // Track these indices so we don't re-add them later
          paragraphTextChangeIndices.add(deletionIndex);
          paragraphTextChangeIndices.add(additionIndex);
          
          // Remove from additions/deletions since we'll handle this specially
          deletions.delete(deletionIndex);
          additions.delete(additionIndex);
          
          // Mark this position for special handling
          nestedChanges.set(additionIndex, {
            __paragraphTextChange: true,
            oldParagraph: deletedContent,
            newParagraph: addedContent,
            changeId
          });
          
          console.log(`Detected paragraph text modification at indices ${deletionIndex}->${additionIndex}`);
          break; // Only match each deletion with one addition
        }
      }
    }
    
    // Filter out false positive changes (content that just shifted position)
    const { filteredAdditions, filteredDeletions, detectedMoves } = filterFalsePositiveChanges(additions, deletions);
    
    // Log detected moves and paragraph changes for debugging
    if (detectedMoves.length > 0 || paragraphTextChanges.size > 0) {
      console.log(`Change detection improvements:`, {
        originalAdditions,
        originalDeletions,
        filteredAdditions: filteredAdditions.size,
        filteredDeletions: filteredDeletions.size,
        movesDetected: detectedMoves.length,
        paragraphTextChanges: paragraphTextChanges.size,
        moves: detectedMoves.map(move => ({
          from: move.fromIndex,
          to: move.toIndex,
          score: move.score,
          type: move.content.type
        }))
      });
    }
    
    // Use filtered results but don't re-add paragraph text change indices
    additions.clear();
    deletions.clear();
    
    filteredAdditions.forEach((value, key) => {
      if (!paragraphTextChangeIndices.has(key)) {
        additions.set(key, value);
      }
    });
    
    filteredDeletions.forEach((value, key) => {
      if (!paragraphTextChangeIndices.has(key)) {
        deletions.set(key, value);
      }
    });
    
    // Second pass: detect text formatting changes (deletion + consecutive additions)
    for (const [deletionIndex, deletedItem] of deletions) {
      if (deletedItem.type === 'text' && deletedItem.text) {
        // Look for consecutive additions starting at the same index
        const consecutiveAdditions = [];
        let currentIndex = deletionIndex;
        
        while (additions.has(currentIndex)) {
          const addedItem = additions.get(currentIndex);
          if (addedItem && addedItem.type === 'text') {
            consecutiveAdditions.push(addedItem);
            currentIndex++;
          } else {
            break;
          }
        }
        
        if (consecutiveAdditions.length > 1) {
          // Check if combined text matches original (indicating formatting change)
          const originalText = deletedItem.text;
          const combinedNewText = consecutiveAdditions.map(item => item.text || '').join('');
          
          if (normalizeText(originalText) === normalizeText(combinedNewText)) {
            // This is a formatting change - create synthetic content arrays
            const oldContent = [deletedItem];
            const newContent = consecutiveAdditions;
            
            formattingChanges.set(deletionIndex, {
              oldContent,
              newContent
            });
            
            // Remove the deletion and additions from their respective maps
            deletions.delete(deletionIndex);
            for (let i = deletionIndex; i < deletionIndex + consecutiveAdditions.length; i++) {
              additions.delete(i);
            }
          }
        }
      }
    }
    
    return { additions, deletions, nestedChanges, formattingChanges };
  }

/**
 * Builds an array with change nodes based on categorized changes
 * @param newArray - The new array
 * @param oldArray - The original array
 * @param changesByType - Categorized changes
 * @param baseChangeId - Base change ID
 * @param path - Current path in the document tree
 * @returns Array with change nodes
 */
export function buildArrayWithChanges(
    newArray: any[],
    oldArray: any[],
    changesByType: {
      additions: Map<number, any>,
      deletions: Map<number, any>,
      nestedChanges: Map<number, any>,
      formattingChanges: Map<number, { oldContent: any[], newContent: any[] }>
    },
    baseChangeId: string,
    path: string[]
  ): any[] {
    const { additions, deletions, nestedChanges, formattingChanges } = changesByType;
    const resultArray: any[] = [];
    const processedIndices = new Set<number>();
    
    // Focus on building the result based on the new array structure
    // Process each position in the new array first
    for (let i = 0; i < newArray.length; i++) {
      if (processedIndices.has(i)) {
        continue;
      }
      
      const addition = additions.get(i);
      const deletion = deletions.get(i);
      const nestedChange = nestedChanges.get(i);
      const formattingChange = formattingChanges.get(i);
      
      if (formattingChange) {
        // Handle formatting changes first
        const changeId = `${baseChangeId}-format-${i}`;
        const formattingDiff = createFormattingDiff(
          formattingChange.oldContent,
          formattingChange.newContent,
          changeId
        );
        
        // Add the formatting diff content directly (it's already an array of inline nodes)
        resultArray.push(...formattingDiff);
        
        // Mark all indices covered by this formatting change as processed
        const numNodes = formattingChange.newContent.length;
        for (let j = i; j < i + numNodes; j++) {
          processedIndices.add(j);
        }
      } else if (nestedChange) {
        // Handle nested changes first (includes paragraph text changes)
        const processedItem = processNestedArrayChange(
          newArray[i],
          oldArray[i],
          nestedChange,
          baseChangeId,
          path,
          i
        );
        if (processedItem) {
          // Handle both single items and arrays of diff nodes
          if (Array.isArray(processedItem)) {
            resultArray.push(...processedItem);
          } else {
            resultArray.push(processedItem);
          }
        }
      } else if (addition && deletion) {
        // Replacement (delete + add at same position)
        const changeId = `${baseChangeId}-replace-${i}`;
        
        // Check if this is a text node replacement that should use granular diff
        if (deletion.type === 'text' && addition.type === 'text' && 
            deletion.text && addition.text &&
            (deletion.text.length >= 60 || addition.text.length >= 60)) {
          
          // Use granular text diff for long text changes
          const textDiff = createTextDiff(deletion.text, addition.text, changeId);
          if (textDiff && textDiff.length > 1) {
            // Add the granular diff nodes instead of full replacement
            resultArray.push(...textDiff);
          } else {
            // Fallback to full replacement
            resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
            resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
          }
        } else {
          // Standard replacement for non-text or short text
          resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
          resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
        }
      } else if (addition) {
        // Just an addition
        const changeId = `${baseChangeId}-add-${i}`;
        resultArray.push(createChangeNode(addition, CHANGE_TYPES.ADDED, changeId));
      } else if (deletion && !newArray[i]) {
        // Pure deletion - only process if there's no actual content at this position
        const changeId = `${baseChangeId}-del-${i}`;
        resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
      } else {
        // Unchanged item from the new array
        // This handles the case where content shifted due to deletions elsewhere
        resultArray.push(newArray[i]);
      }
    }
    
    // Handle remaining deletions that don't correspond to any position in the new array
    // These are pure deletions (items that were removed completely)
    for (const [index, deletion] of deletions) {
      if (index >= newArray.length) {
        // Only add deletions for indices beyond the new array length
        const changeId = `${baseChangeId}-del-${index}`;
        resultArray.push(createChangeNode(deletion, CHANGE_TYPES.DELETED, changeId));
      }
    }
    
    return resultArray;
  }
  
  /**
   * Processes nested changes within an array item
   * @param newItem - The new array item
   * @param oldItem - The original array item
   * @param nestedChange - The nested change delta
   * @param baseChangeId - Base change ID
   * @param path - Current path in the document tree
   * @param index - Array index
   * @returns Processed item with nested changes or array of diff nodes
   */
  export function processNestedArrayChange(
    newItem: any,
    oldItem: any,
    nestedChange: any,
    baseChangeId: string,
    path: string[],
    index: number
  ): any | any[] {
    // Check if this is a special paragraph text change
    if (nestedChange.__paragraphTextChange) {
      const { oldParagraph, newParagraph, changeId } = nestedChange;
      const paragraphChanges = createParagraphTextChanges(oldParagraph, newParagraph, changeId);
      // Return the array of change nodes (will be spread into the result)
      return paragraphChanges;
    }
    
    if (newItem && oldItem) {
      // Check if this is a text node modification that should use granular diff
      if (newItem.type === 'text' && oldItem.type === 'text' && 
          nestedChange.text && Array.isArray(nestedChange.text) && nestedChange.text.length === 2) {
        
        const [oldText, newText] = nestedChange.text;
        const changeId = `${baseChangeId}-mod-${index}`;
        
        // Try to create granular text diff
        const textDiff = handleTextDelta(newItem, oldText, newText, changeId);
        if (textDiff) {
          // Return the diff nodes to replace the single text node
          return textDiff;
        }
      }
      
      // Standard nested change processing
      const modifiedItem = JSON.parse(JSON.stringify(newItem));
      const arrayKey = path[path.length - 1] || 'content';
      applyJsonDelta(
        modifiedItem,
        oldItem,
        nestedChange,
        `${baseChangeId}-mod-${index}`,
        [...path, arrayKey, index.toString()]
      );
      return modifiedItem;
    } else if (newItem) {
      // Fallback - just use the new item
      return newItem;
    }
    return null;
  }