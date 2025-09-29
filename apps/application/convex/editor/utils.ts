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
  console.log('📚 createProseMirrorChunks: Starting chunk creation');
  console.log('📚 createProseMirrorChunks: Input parameters:', {
    docSize: doc.content.size,
    docType: doc.type.name,
    childCount: doc.childCount,
    maxChars
  });
  
  const chunks: Array<{ from: number; to: number; text: string }> = [];
  let currentChunkStart = 0; // ProseMirror docs start at position 0
  let currentChunkText = "";
  let lastGoodBreakPoint = 0;
  let lastGoodBreakText = "";
  let processedNodes = 0;
  
  doc.descendants((node: Node, pos: number) => {
    processedNodes++;
    const nodeText = extractTextFromNode(node);
    const nodeSize = node.nodeSize || 1;
    const nodeEnd = pos + nodeSize;
    
    // Consider this a good break point if it's a block-level element
    const isGoodBreakPoint = node.isBlock || 
                            node.type.name === "heading" || 
                            node.type.name === "paragraph" ||
                            node.type.name === "listItem";
    
    if (processedNodes <= 10 || processedNodes % 50 === 0) {
      console.log(`📚 createProseMirrorChunks: Processing node ${processedNodes}:`, {
        nodeType: node.type.name,
        nodeSize,
        position: pos,
        nodeEnd,
        textLength: nodeText.length,
        textPreview: nodeText.substring(0, 50) + (nodeText.length > 50 ? '...' : ''),
        isBlock: node.isBlock,
        isGoodBreakPoint,
        currentChunkLength: currentChunkText.length,
        wouldExceedLimit: currentChunkText.length + nodeText.length > maxChars
      });
    }
    
    // Check if adding this node would exceed the character limit
    if (currentChunkText.length + nodeText.length > maxChars && currentChunkText.length > 0) {
      console.log(`📚 createProseMirrorChunks: Node ${processedNodes} - Would exceed limit, creating chunk:`, {
        currentChunkLength: currentChunkText.length,
        nodeTextLength: nodeText.length,
        totalWouldBe: currentChunkText.length + nodeText.length,
        maxChars,
        hasGoodBreakPoint: lastGoodBreakPoint > currentChunkStart,
        lastGoodBreakLength: lastGoodBreakText.length
      });
      // Use the last good break point if we have one and it would create a smaller chunk
      if (lastGoodBreakPoint > currentChunkStart && lastGoodBreakText.length <= maxChars) {
        console.log(`📚 createProseMirrorChunks: Node ${processedNodes} - Using good break point for chunk:`, {
          chunkIndex: chunks.length,
          from: currentChunkStart,
          to: lastGoodBreakPoint,
          textLength: lastGoodBreakText.length
        });
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
        console.log(`📚 createProseMirrorChunks: Node ${processedNodes} - Creating truncated chunk:`, {
          chunkIndex: chunks.length,
          from: currentChunkStart,
          to: pos,
          originalLength: currentChunkText.length,
          truncatedLength: truncatedText.length
        });
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
        console.log(`📚 createProseMirrorChunks: Node ${processedNodes} - Updated good break point:`, {
          breakPoint: lastGoodBreakPoint,
          breakTextLength: lastGoodBreakText.length
        });
      }
    }
    
    // Continue traversing for container nodes, stop for leaf nodes
    return !node.isLeaf;
  });
  
  console.log(`📚 createProseMirrorChunks: Finished processing ${processedNodes} nodes`);
  
  // Add the final chunk if there's remaining content
  if (currentChunkText.length > 0) {
    console.log('📚 createProseMirrorChunks: Creating final chunk:', {
      currentChunkLength: currentChunkText.length,
      currentChunkStart,
      docSize: doc.content.size
    });
    
    // Ensure final chunk doesn't exceed maxChars
    const finalText = currentChunkText.length <= maxChars ? currentChunkText : currentChunkText.substring(0, maxChars);
    chunks.push({
      from: currentChunkStart,
      to: doc.content.size, // End of document
      text: finalText
    });
    console.log(`📚 createProseMirrorChunks: Final chunk created (index ${chunks.length - 1}):`, {
      from: currentChunkStart,
      to: doc.content.size,
      textLength: finalText.length,
      wasTruncated: finalText.length < currentChunkText.length
    });
  } else {
    console.log('📚 createProseMirrorChunks: No final chunk needed (no remaining content)');
  }
  
  console.log('📚 createProseMirrorChunks: ✅ Chunk creation completed:', {
    totalChunks: chunks.length,
    totalNodesProcessed: processedNodes,
    chunkSummary: chunks.map((chunk, i) => ({
      index: i,
      from: chunk.from,
      to: chunk.to,
      textLength: chunk.text.length,
      textPreview: chunk.text.substring(0, 50) + (chunk.text.length > 50 ? '...' : '')
    }))
  });
  
  return chunks;
}
