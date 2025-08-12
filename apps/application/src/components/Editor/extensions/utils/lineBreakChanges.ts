import { CHANGE_TYPES } from './types';

/**
 * Detects line break changes between two documents by analyzing paragraph splits
 * @param oldDoc - The original document
 * @param newDoc - The modified document
 * @returns Array of line break change patterns if detected, null otherwise
 */
export function detectLineBreakChanges(oldDoc: any, newDoc: any): any[] | null {
  const changes: any[] = [];
  
  // Check if this is a paragraph split scenario
  const splitInfo = detectParagraphSplitAsLineBreak(oldDoc, newDoc);
  if (splitInfo) {
    changes.push(splitInfo);
  }
  
  // Also check for explicit hardBreak node changes
  const hardBreakChanges = detectHardBreakChanges(oldDoc, newDoc);
  if (hardBreakChanges) {
    changes.push(...hardBreakChanges);
  }
  
  return changes.length > 0 ? changes : null;
}

/**
 * Detects when a paragraph split should be treated as a line break insertion
 */
function detectParagraphSplitAsLineBreak(oldDoc: any, newDoc: any): any | null {
  // Check for paragraph splits - one or more paragraphs becoming multiple paragraphs
  if (!oldDoc.content || !newDoc.content || newDoc.content.length <= oldDoc.content.length) {
    return null;
  }
  
  // Check if all content are paragraphs
  const allOldParagraphs = oldDoc.content.every((node: any) => node.type === 'paragraph');
  const allNewParagraphs = newDoc.content.every((node: any) => node.type === 'paragraph');
  
  if (!allOldParagraphs || !allNewParagraphs) {
    return null;
  }
  
  // Extract text from all paragraphs
  const oldText = oldDoc.content.map((p: any) => extractTextFromParagraph(p)).join('');
  const newText = newDoc.content.map((p: any) => extractTextFromParagraph(p)).join('');
  
  // If the combined text matches the original, this is a split (multiple line breaks)
  if (normalizeText(oldText) === normalizeText(newText)) {
    // Calculate split points
    const splitPoints: number[] = [];
    let cumulativeLength = 0;
    
    // For each new paragraph except the last, record where the split occurs
    for (let i = 0; i < newDoc.content.length - 1; i++) {
      const paragraphText = extractTextFromParagraph(newDoc.content[i]);
      cumulativeLength += paragraphText.length;
      splitPoints.push(cumulativeLength);
    }
    
    return {
      type: 'multiple_paragraph_splits_as_linebreaks',
      changeType: CHANGE_TYPES.ADDED,
      splitPoints: splitPoints,
      originalParagraphs: oldDoc.content,
      newParagraphs: newDoc.content,
      totalSplits: splitPoints.length
    };
  }
  
  return null;
}

/**
 * Detects explicit hardBreak node changes
 */
function detectHardBreakChanges(oldDoc: any, newDoc: any): any[] | null {
  const changes: any[] = [];
  
  // Extract all line breaks (hardBreak nodes) from both documents
  const oldBreaks = extractLineBreaks(oldDoc);
  const newBreaks = extractLineBreaks(newDoc);
  
  // Find added line breaks (in new but not in old)
  newBreaks.forEach((newBreak) => {
    const matchingOldBreak = oldBreaks.find(oldBreak => 
      areBreaksAtSamePosition(oldBreak, newBreak, oldDoc, newDoc)
    );
    
    if (!matchingOldBreak) {
      changes.push({
        type: 'line_break_addition',
        position: newBreak.position,
        path: newBreak.path,
        changeType: CHANGE_TYPES.ADDED
      });
    }
  });
  
  // Find deleted line breaks (in old but not in new)
  oldBreaks.forEach((oldBreak) => {
    const matchingNewBreak = newBreaks.find(newBreak => 
      areBreaksAtSamePosition(oldBreak, newBreak, oldDoc, newDoc)
    );
    
    if (!matchingNewBreak) {
      changes.push({
        type: 'line_break_deletion',
        position: oldBreak.position,
        path: oldBreak.path,
        changeType: CHANGE_TYPES.DELETED
      });
    }
  });
  
  return changes.length > 0 ? changes : null;
}

/**
 * Extracts text content from a paragraph node
 */
function extractTextFromParagraph(paragraph: any): string {
  if (!paragraph.content) return '';
  
  return paragraph.content
    .filter((node: any) => node.type === 'text')
    .map((node: any) => node.text || '')
    .join('');
}

/**
 * Normalizes text for comparison (removes extra whitespace)
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts all hardBreak nodes from a document with their positions
 * @param doc - Document to scan
 * @returns Array of line break information
 */
function extractLineBreaks(doc: any): Array<{position: number, path: number[], node: any}> {
  const breaks: Array<{position: number, path: number[], node: any}> = [];
  
  function traverse(node: any, path: number[] = [], position: number = 0): number {
    let currentPos = position;
    
    if (node.type === 'hardBreak') {
      breaks.push({
        position: currentPos,
        path: [...path],
        node: node
      });
      return currentPos + 1;
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child: any, index: number) => {
        const childPos = traverse(child, [...path, index], currentPos);
        currentPos = childPos;
      });
    }
    
    if (node.text) {
      currentPos += node.text.length;
    }
    
    return currentPos;
  }
  
  traverse(doc);
  return breaks;
}

/**
 * Determines if two line breaks are at the same logical position
 * @param oldBreak - Line break from old document
 * @param newBreak - Line break from new document
 * @param oldDoc - Original document
 * @param newDoc - Modified document
 * @returns True if breaks are at same position
 */
function areBreaksAtSamePosition(
  oldBreak: any, 
  newBreak: any, 
  oldDoc: any, 
  newDoc: any
): boolean {
  // Simple heuristic: compare the text context before and after the break
  const oldContext = getBreakContext(oldBreak, oldDoc);
  const newContext = getBreakContext(newBreak, newDoc);
  
  return (
    oldContext.before === newContext.before && 
    oldContext.after === newContext.after
  );
}

/**
 * Gets text context around a line break for comparison
 * @param breakInfo - Line break information
 * @param doc - Document containing the break
 * @returns Context before and after the break
 */
function getBreakContext(breakInfo: any, doc: any): {before: string, after: string} {
  // Extract a few characters before and after the break position
  const fullText = extractAllText(doc);
  const position = breakInfo.position;
  
  const before = fullText.substring(Math.max(0, position - 10), position);
  const after = fullText.substring(position, Math.min(fullText.length, position + 10));
  
  return { before, after };
}

/**
 * Extracts all text content from a document
 * @param doc - Document to extract text from
 * @returns Combined text content
 */
function extractAllText(doc: any): string {
  let text = '';
  
  function traverse(node: any): void {
    if (node.type === 'text') {
      text += node.text;
    } else if (node.type === 'hardBreak') {
      text += '\n';
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }
  
  traverse(doc);
  return text;
}

/**
 * Creates line break change nodes from detected changes
 * @param newDoc - The modified document
 * @param lineBreakChanges - Detected line break changes
 * @param baseChangeId - Base change ID for grouping
 * @returns Document with line break change nodes
 */
export function buildContentWithLineBreakChanges(
  newDoc: any,
  lineBreakChanges: any[],
  baseChangeId: string
): any {
  const result = JSON.parse(JSON.stringify(newDoc));
  
  // Process each line break change
  lineBreakChanges.forEach((change, index) => {
    const changeId = `${baseChangeId}-linebreak-${index}`;
    
    if (change.type === 'multiple_paragraph_splits_as_linebreaks') {
      // Handle multiple paragraph splits as line break insertions
      handleMultipleParagraphSplitsAsLineBreaks(result, change, changeId);
    } else if (change.type === 'paragraph_split_as_linebreak') {
      // Handle single paragraph split as line break insertion (legacy support)
      handleParagraphSplitAsLineBreak(result, change, changeId);
    } else {
      // Handle regular line break changes
      insertLineBreakChangeNode(result, {...change, changeId});
    }
  });
  
  return result;
}

/**
 * Handles multiple paragraph splits by creating a single paragraph with multiple line break change nodes
 */
function handleMultipleParagraphSplitsAsLineBreaks(doc: any, change: any, baseChangeId: string): void {
  const { newParagraphs, splitPoints } = change;
  
  // Extract all text segments
  const textSegments = newParagraphs.map((para: any) => extractTextFromParagraph(para));
  
  // Build the content array with text and line break change nodes
  const combinedContent: any[] = [];
  
  for (let i = 0; i < textSegments.length; i++) {
    const text = textSegments[i];
    
    // Add text segment if not empty
    if (text) {
      combinedContent.push({
        type: 'text',
        text: text
      });
    }
    
    // Add line break change node between segments (but not after the last segment)
    if (i < textSegments.length - 1) {
      const lineBreakChangeId = `${baseChangeId}-split-${i}`;
      combinedContent.push({
        type: 'lineBreakChange',
        attrs: {
          changeType: CHANGE_TYPES.ADDED,
          changeId: lineBreakChangeId,
          semanticType: 'line_break'
        }
      });
    }
  }
  
  // Create a single paragraph that contains all text segments and line break nodes
  const combinedParagraph = {
    type: 'paragraph',
    content: combinedContent
  };
  
  // Replace all the split paragraphs with the combined one
  doc.content.splice(0, newParagraphs.length, combinedParagraph);
}

/**
 * Handles paragraph splits by creating a single paragraph with a line break change node
 */
function handleParagraphSplitAsLineBreak(doc: any, change: any, changeId: string): void {
  const { newParagraphs, splitPoint } = change;
  const [firstPara, secondPara] = newParagraphs;
  
  // Create a single paragraph that combines both parts with a line break in between
  const firstText = extractTextFromParagraph(firstPara);
  const secondText = extractTextFromParagraph(secondPara);
  
  // Build the content array with line break change node
  const combinedContent: any[] = [];
  
  // Add first part text
  if (firstText) {
    combinedContent.push({
      type: 'text',
      text: firstText
    });
  }
  
  // Add line break change node
  combinedContent.push({
    type: 'lineBreakChange',
    attrs: {
      changeType: CHANGE_TYPES.ADDED,
      changeId: changeId,
      semanticType: 'line_break'
    }
  });
  
  // Add second part text
  if (secondText) {
    combinedContent.push({
      type: 'text',
      text: secondText
    });
  }
  
  // Replace the two paragraphs with one paragraph containing the line break
  const combinedParagraph = {
    type: 'paragraph',
    content: combinedContent
  };
  
  // Replace the first two paragraphs with the combined one
  doc.content.splice(0, 2, combinedParagraph);
}

/**
 * Inserts a line break change node at the specified position
 * @param doc - Document to modify
 * @param change - Line break change information
 */
function insertLineBreakChangeNode(doc: any, change: any): void {
  const { path, changeType, changeId } = change;
  
  // Navigate to the correct position in the document
  let currentNode = doc;
  for (let i = 0; i < path.length - 1; i++) {
    if (currentNode.content && currentNode.content[path[i]]) {
      currentNode = currentNode.content[path[i]];
    } else {
      return; // Path doesn't exist
    }
  }
  
  if (!currentNode.content) {
    currentNode.content = [];
  }
  
  const insertIndex = path[path.length - 1];
  
  // Create the line break change node
  const lineBreakChangeNode = {
    type: 'lineBreakChange',
    attrs: {
      changeType: changeType,
      changeId: changeId,
      semanticType: 'line_break'
    }
  };
  
  if (changeType === CHANGE_TYPES.ADDED) {
    // Insert at the specified position
    currentNode.content.splice(insertIndex, 0, lineBreakChangeNode);
  } else if (changeType === CHANGE_TYPES.DELETED) {
    // Replace existing hardBreak with change node
    if (currentNode.content[insertIndex] && currentNode.content[insertIndex].type === 'hardBreak') {
      currentNode.content[insertIndex] = lineBreakChangeNode;
    } else {
      // Insert as deleted indicator
      currentNode.content.splice(insertIndex, 0, lineBreakChangeNode);
    }
  }
} 