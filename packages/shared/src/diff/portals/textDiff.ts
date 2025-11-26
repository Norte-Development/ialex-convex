import { diff_match_patch } from '@dmsnell/diff-match-patch';
import { CHANGE_TYPES, type ChangeType } from '../types';
import { DIFF_CONFIG } from '../constants';

/**
 * Calculates the similarity ratio between two strings (0 to 1).
 * Higher values mean more similar.
 */
function calculateSimilarity(oldText: string, newText: string): number {
  if (oldText === newText) return 1;
  if (oldText.length === 0 || newText.length === 0) return 0;
  
  const maxLen = Math.max(oldText.length, newText.length);
  const minLen = Math.min(oldText.length, newText.length);
  
  // Quick length-based similarity estimate
  const lengthRatio = minLen / maxLen;
  
  // For very different lengths, return early
  if (lengthRatio < 0.3) return lengthRatio;
  
  // Count common characters (simple overlap check using object instead of Set)
  const oldChars: Record<string, boolean> = {};
  const newChars: Record<string, boolean> = {};
  
  const oldLower = oldText.toLowerCase();
  const newLower = newText.toLowerCase();
  
  for (let i = 0; i < oldLower.length; i++) {
    oldChars[oldLower[i]] = true;
  }
  for (let i = 0; i < newLower.length; i++) {
    newChars[newLower[i]] = true;
  }
  
  const oldKeys = Object.keys(oldChars);
  const newKeys = Object.keys(newChars);
  
  let commonCount = 0;
  for (let i = 0; i < oldKeys.length; i++) {
    if (newChars[oldKeys[i]]) commonCount++;
  }
  
  const charSimilarity = commonCount / Math.max(oldKeys.length, newKeys.length);
  
  // Combine length and character similarity
  return (lengthRatio + charSimilarity) / 2;
}

/**
 * Creates a granular text diff using diff-match-patch
 * @param oldText - The original text
 * @param newText - The new text
 * @param changeId - The change ID
 * @returns Array of text nodes with change annotations
 */
export function createTextDiff(oldText: string, newText: string, changeId: string): any[] {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(diffs);
    
    const result: any[] = [];
    
    for (const [operation, text] of diffs) {
      if (text.length === 0) continue;
      
      if (operation === 0) {
        // Equal/unchanged text
        result.push({
          type: 'text',
          text: text
        });
      } else if (operation === -1) {
        // Deleted text - use the same changeId for grouped operations
        result.push({
          type: 'inlineChange',
          attrs: {
            changeType: CHANGE_TYPES.DELETED,
            changeId: changeId,
            semanticType: 'text_change'
          },
          content: [{
            type: 'text',
            text: text
          }]
        });
      } else if (operation === 1) {
        // Added text - use the same changeId for grouped operations
        result.push({
          type: 'inlineChange',
          attrs: {
            changeType: CHANGE_TYPES.ADDED,
            changeId: changeId,
            semanticType: 'text_change'
          },
          content: [{
            type: 'text',
            text: text
          }]
        });
      }
    }
    
    return result;
  }

  
/**
 * Handles text-specific delta changes with change tracking.
 * Uses adaptive threshold based on text similarity for better diff decisions.
 * @param textNode - The text node to modify
 * @param oldText - The original text
 * @param newText - The new text
 * @param changeId - The change ID
 * @returns Array of diff nodes if granular diff is used, null otherwise
 */
export function handleTextDelta(textNode: any, oldText: string, newText: string, changeId: string): any[] | null {
    const minLength = DIFF_CONFIG.TEXT_DIFF_MIN_LENGTH;
    const similarityThreshold = DIFF_CONFIG.SIMILARITY_THRESHOLD_FOR_DIFF;
    
    // Calculate similarity to make adaptive decision
    const similarity = calculateSimilarity(oldText, newText);
    
    // Use granular diff if:
    // 1. Either text is long enough, OR
    // 2. Texts are similar enough (small edits worth showing granularly)
    const shouldUseGranularDiff = 
      (oldText.length >= minLength || newText.length >= minLength) ||
      (similarity >= similarityThreshold && oldText.length > 10 && newText.length > 10);
    
    if (shouldUseGranularDiff) {
      // Use diff-match-patch for granular changes
      const textDiff = createTextDiff(oldText, newText, changeId);
      if (textDiff && textDiff.length > 1) {
        // Return the diff result for the parent to handle
        return textDiff;
      }
    }
    
    // Fallback to simple text replacement for short texts or when diff doesn't provide granular changes
    textNode.text = newText;
    
    // Add change metadata for tracking
    textNode.__textChange = {
      type: CHANGE_TYPES.MODIFIED,
      old: oldText,
      new: newText,
      changeId
    };
    
    return null;
  }