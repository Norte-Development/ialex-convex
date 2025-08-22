import { diff_match_patch } from '@dmsnell/diff-match-patch';
import { CHANGE_TYPES, type ChangeType } from '../types';

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
 * Handles text-specific delta changes with change tracking
 * @param textNode - The text node to modify
 * @param oldText - The original text
 * @param newText - The new text
 * @param changeId - The change ID
 * @returns Array of diff nodes if granular diff is used, null otherwise
 */
export function handleTextDelta(textNode: any, oldText: string, newText: string, changeId: string): any[] | null {
    // Check if we should use text diff for long texts
    if (oldText.length >= 60 || newText.length >= 60) {
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