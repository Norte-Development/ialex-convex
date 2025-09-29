'use node'
import { Node } from '@tiptap/pm/model';

/**
 * Extract text content from a ProseMirror node, excluding deleted changes.
 * This gives us the actual text that would be visible in the document.
 */
export function extractTextFromNode(node: Node): string {
  if (node.type.name === "text") {
    return node.text || "";
  }
  
  // Handle custom change nodes - exclude deleted content
  if (node.type.name === "inlineChange" || node.type.name === "blockChange") {
    const changeType = node.attrs?.changeType;
    if (changeType === "deleted") {
      return ""; // Exclude deleted content
    }
  }
  
  if (node.type.name === "lineBreakChange") {
    const changeType = node.attrs?.changeType;
    return changeType === "deleted" ? "" : "\n";
  }
  
  if (node.type.name === "hardBreak") {
    return "\n";
  }
  
  // For container nodes, concatenate children
  let text = "";
  if (node.content) {
    node.content.forEach((child: Node) => {
      text += extractTextFromNode(child);
    });
  }
  
  return text;
}

/**
 * Create semantic chunks from ProseMirror document using actual node boundaries.
 * Respects chunkSize as maximum character count while maintaining document structure.
 */
export function createProseMirrorChunks(doc: Node, maxChars: number): Array<{ from: number; to: number; text: string }> {
  const chunks: Array<{ from: number; to: number; text: string }> = [];
  let currentChunkStart = 1; // ProseMirror docs start at position 1
  let currentChunkText = "";
  let lastGoodBreakPoint = 1;
  let lastGoodBreakText = "";
  
  doc.descendants((node: Node, pos: number) => {
    const nodeText = extractTextFromNode(node);
    const nodeSize = node.nodeSize || 1;
    const nodeEnd = pos + nodeSize;
    
    // Consider this a good break point if it's a block-level element
    const isGoodBreakPoint = node.isBlock || 
                            node.type.name === "heading" || 
                            node.type.name === "paragraph" ||
                            node.type.name === "listItem";
    
    // Check if adding this node would exceed the character limit
    if (currentChunkText.length + nodeText.length > maxChars && currentChunkText.length > 0) {
      // Use the last good break point if we have one and it would create a smaller chunk
      if (lastGoodBreakPoint > currentChunkStart && lastGoodBreakText.length <= maxChars) {
        chunks.push({
          from: currentChunkStart,
          to: lastGoodBreakPoint,
          text: lastGoodBreakText
        });
        currentChunkStart = lastGoodBreakPoint;
        currentChunkText = nodeText;
      } else {
        // If no good break point or it would still be too long, truncate current chunk
        const truncatedText = currentChunkText.length <= maxChars ? currentChunkText : currentChunkText.substring(0, maxChars);
        chunks.push({
          from: currentChunkStart,
          to: pos,
          text: truncatedText
        });
        currentChunkStart = pos;
        currentChunkText = nodeText;
      }
      lastGoodBreakPoint = isGoodBreakPoint ? nodeEnd : currentChunkStart;
      lastGoodBreakText = isGoodBreakPoint ? currentChunkText : "";
    } else {
      // Add this node to current chunk
      currentChunkText += nodeText;
      if (isGoodBreakPoint) {
        lastGoodBreakPoint = nodeEnd;
        lastGoodBreakText = currentChunkText;
      }
    }
    
    // Continue traversing for container nodes, stop for leaf nodes
    return !node.isLeaf;
  });
  
  // Add the final chunk if there's remaining content
  if (currentChunkText.length > 0) {
    // Ensure final chunk doesn't exceed maxChars
    const finalText = currentChunkText.length <= maxChars ? currentChunkText : currentChunkText.substring(0, maxChars);
    chunks.push({
      from: currentChunkStart,
      to: doc.content.size + 1, // End of document
      text: finalText
    });
  }
  
  return chunks;
}
