import { CHANGE_TYPES, type ChangeType } from './types';
import { extractCombinedText, normalizeText } from './utils';

/**
 * Detects if a content change is actually a formatting change
 * @param oldContent - Original content array
 * @param newContent - New content array
 * @returns True if this is a formatting change, false otherwise
 */
export function detectFormattingChanges(oldContent: any[], newContent: any[]): boolean {
    if (!oldContent || !newContent) return false;
    
    // Check if combined text is same but node structure differs
    const oldText = extractCombinedText(oldContent);
    const newText = extractCombinedText(newContent);
    
    // If text content is the same but structure changed, it's likely a formatting change
    return normalizeText(oldText) === normalizeText(newText) && 
           (oldContent.length !== newContent.length || hasFormattingDifferences(oldContent, newContent));
  }
  
  /**
   * Checks if there are formatting differences between content arrays
   * @param oldContent - Original content array
   * @param newContent - New content array
   * @returns True if formatting differences exist
   */
  export function hasFormattingDifferences(oldContent: any[], newContent: any[]): boolean {
    // Simple check: compare marks/formatting
    const oldMarks = oldContent.flatMap(node => node.marks || []);
    const newMarks = newContent.flatMap(node => node.marks || []);
    
    return JSON.stringify(oldMarks) !== JSON.stringify(newMarks);
  }
  
  /**
   * Creates a granular formatting diff between old and new content arrays
   * @param oldContent - Original content array
   * @param newContent - New content array  
   * @param changeId - The change ID for tracking
   * @returns Array of nodes with formatting change annotations
   */
  export function createFormattingDiff(oldContent: any[], newContent: any[], changeId: string): any[] {
    if (!detectFormattingChanges(oldContent, newContent)) {
      return newContent; // No formatting changes detected
    }
    
    const result: any[] = [];
    const oldText = extractCombinedText(oldContent);
    const newText = extractCombinedText(newContent);
    
    // If text content is identical, we can create a detailed formatting diff
    if (normalizeText(oldText) === normalizeText(newText)) {
      // Map each character position to its formatting in old and new content
      const oldCharFormats = mapCharacterFormats(oldContent);
      const newCharFormats = mapCharacterFormats(newContent);
      
      let currentPos = 0;
      let segmentStart = 0;
      
      // Walk through each character and group by formatting changes
      while (currentPos < newText.length) {
        const oldFormat = oldCharFormats[currentPos] || [];
        const newFormat = newCharFormats[currentPos] || [];
        
        // Check if formatting changed at this position
        if (JSON.stringify(oldFormat) !== JSON.stringify(newFormat)) {
          // Find the end of this formatting segment
          let segmentEnd = currentPos;
          while (segmentEnd < newText.length && 
                 JSON.stringify(newCharFormats[segmentEnd] || []) === JSON.stringify(newFormat)) {
            segmentEnd++;
          }
          
          // Add previous unchanged segment if exists
          if (segmentStart < currentPos) {
            result.push({
              type: 'text',
              text: newText.substring(segmentStart, currentPos),
              marks: oldCharFormats[segmentStart] || []
            });
          }
          
          // Add formatting change as deletion + addition pair (like text replacement)
          const segmentText = newText.substring(currentPos, segmentEnd);
          if (segmentText.length > 0) {
            // First, show the deleted version (old formatting)
            result.push({
              type: 'inlineChange',
              attrs: {
                changeType: CHANGE_TYPES.DELETED,
                changeId: changeId,
                semanticType: 'formatting_change',
                description: `Removed formatting: ${formatMarksDescription(newFormat, oldFormat)}`
              },
              content: [{
                type: 'text',
                text: segmentText,
                marks: oldFormat
              }]
            });
            
            // Then, show the added version (new formatting)
            result.push({
              type: 'inlineChange',
              attrs: {
                changeType: CHANGE_TYPES.ADDED,
                changeId: changeId,
                semanticType: 'formatting_change',
                description: `Added formatting: ${formatMarksDescription(oldFormat, newFormat)}`
              },
              content: [{
                type: 'text',
                text: segmentText,
                marks: newFormat
              }]
            });
          }
          
          currentPos = segmentEnd;
          segmentStart = segmentEnd;
        } else {
          currentPos++;
        }
      }
      
      // Add final unchanged segment if exists
      if (segmentStart < newText.length) {
        result.push({
          type: 'text',
          text: newText.substring(segmentStart),
          marks: newCharFormats[segmentStart] || []
        });
      }
      
      return result.length > 0 ? result : newContent;
    }
    
    // Fallback: show as deletion + addition pair
    return [
      {
        type: 'inlineChange',
        attrs: {
          changeType: CHANGE_TYPES.DELETED,
          changeId: changeId,
          semanticType: 'formatting_change',
          description: 'Removed formatting'
        },
        content: oldContent
      },
      {
        type: 'inlineChange',
        attrs: {
          changeType: CHANGE_TYPES.ADDED,
          changeId: changeId,
          semanticType: 'formatting_change',
          description: 'Added formatting'
        },
        content: newContent
      }
    ];
  }
  
  /**
   * Maps each character position to its formatting marks
   * @param content - Content array to analyze
   * @returns Array where each index represents character position and value is formatting marks
   */
  export function mapCharacterFormats(content: any[]): any[][] {
    const result: any[][] = [];
    let charIndex = 0;
    
    for (const node of content) {
      if (node.type === 'text' && node.text) {
        const marks = node.marks || [];
        for (let i = 0; i < node.text.length; i++) {
          result[charIndex + i] = marks;
        }
        charIndex += node.text.length;
      }
    }
    
    return result;
  }
  
  /**
   * Creates a human-readable description of formatting changes
   * @param oldMarks - Original formatting marks
   * @param newMarks - New formatting marks
   * @returns Description string
   */
  export function formatMarksDescription(oldMarks: any[], newMarks: any[]): string {
    const oldTypes = oldMarks.map(m => m.type);
    const newTypes = newMarks.map(m => m.type);
    
    const added = newTypes.filter(t => !oldTypes.includes(t));
    const removed = oldTypes.filter(t => !newTypes.includes(t));
    
    const changes = [];
    if (added.length > 0) changes.push(`+${added.join(',')}`);
    if (removed.length > 0) changes.push(`-${removed.join(',')}`);
    
    return changes.join(' ') || 'formatting modified';
  }