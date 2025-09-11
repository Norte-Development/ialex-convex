import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../_generated/api";
import { z } from "zod";
import { prosemirrorSync } from "../../prosemirror";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";

export interface ChunkMetadata {
  chunkIndex: number;
  startPos: number;
  endPos: number;
  sectionPath: string[]; // ["Chapter 1", "Section A", "Subsection 1"]
  nodeTypes: string[]; // ["heading", "paragraph", "list"]
  hasStructuralBoundary: boolean; // true if chunk starts/ends at heading or major section
}

export interface ProcessedChunk extends ChunkMetadata {
  text: string;
  preview: string;
  wordCount: number;
  hasMore: boolean; // indicates if chunk was truncated due to size limits
}

export interface DocumentNode {
  type: string;
  text: string;
  pos: number;
  level?: number; // for headings
  isStructuralBoundary: boolean;
}
  
  const MAX_WORDS_PER_CHUNK = 300;


export const getEscritoOutline = (doc: Node) => {
    const outline: { text: string, pos: number, chunkIndex: number, chunkCount: number, type: string }[] = [];
    let index = 0;
    let chunkCount = 0;
    doc.content.descendants((node, pos) => {
        if (node.type.name === "heading" || node.type.name === "paragraph") {
            const text = node.type.name === "heading" ? node.textContent : node.textContent.slice(0, 100);
            if (text.length === 0) return;
            outline.push({
                text,
                pos,
                chunkIndex: index,
                chunkCount,
                type: node.type.name,
            });
            index++;
            chunkCount++;
        }
    });

    return outline;
}



/**
 * Extract all text nodes from ProseMirror document with proper tree traversal
 */
export function extractDocumentNodes(doc: Node): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  const sectionStack: string[] = [];

  console.log("🔍 Starting document extraction from node type:", doc.type.name);
  
  doc.descendants((node, pos) => {
    // Handle headings - update section context
    if (node.type.name === "heading") {
      const level = node.attrs?.level || 1;
      const headingText = node.textContent.trim();
      
      if (headingText) {
        // Update section stack based on heading level
        sectionStack.splice(level - 1);
        sectionStack[level - 1] = headingText;
        
        nodes.push({
          type: "heading",
          text: headingText,
          pos,
          level,
          isStructuralBoundary: true,
        });
      }
      return false; // Don't traverse into heading children
    }

    // Handle content nodes
    if (["paragraph", "list_item", "table_cell", "code_block"].includes(node.type.name)) {
      const text = node.textContent.trim();
      if (text) {
        nodes.push({
          type: node.type.name,
          text,
          pos,
          isStructuralBoundary: node.type.name === "code_block",
        });
      }
      return false; // Don't traverse into these nodes' children
    }

    // Handle lists and tables as structural boundaries
    if (["bullet_list", "ordered_list", "table"].includes(node.type.name)) {
      return true; // Traverse children but mark as structural
    }

    return true; // Continue traversing
  });

  console.log("📝 Document extraction complete. Found", nodes.length, "nodes");
  return nodes;
}

/**
 * Generate semantic-aware chunks from document nodes
 */
export function createSemanticChunks(nodes: DocumentNode[]): ChunkMetadata[] {
  console.log("🔧 createSemanticChunks called with", nodes.length, "nodes");
  
  const chunks: ChunkMetadata[] = [];
  let currentChunk: {
    nodes: DocumentNode[];
    wordCount: number;
    startPos: number;
    endPos: number;
    sectionPath: string[];
    nodeTypes: Set<string>;
  } | null = null;

  const sectionStack: string[] = [];

  const flushChunk = () => {
    if (!currentChunk || currentChunk.nodes.length === 0) {
      console.log("🚫 No chunk to flush or chunk is empty");
      return;
    }
    
    console.log("💾 Flushing chunk with", currentChunk.nodes.length, "nodes,", currentChunk.wordCount, "words");

    chunks.push({
      chunkIndex: chunks.length,
      startPos: currentChunk.startPos,
      endPos: currentChunk.endPos,
      sectionPath: [...currentChunk.sectionPath],
      nodeTypes: Array.from(currentChunk.nodeTypes),
      hasStructuralBoundary: currentChunk.nodes.some(n => n.isStructuralBoundary),
    });

    currentChunk = null;
  };

  for (const node of nodes) {
    console.log("🔍 Processing node:", { type: node.type, text: node.text.substring(0, 50) + "...", pos: node.pos });
    
    // Update section context for headings
    if (node.type === "heading" && node.level) {
      sectionStack.splice(node.level - 1);
      sectionStack[node.level - 1] = node.text;
      
      // Flush current chunk at major structural boundaries
      if (node.level <= 2) {
        console.log("🏁 Flushing at major heading level", node.level);
        flushChunk();
      }
    }

    const nodeWordCount = node.text.split(/\s+/).length;

    // Initialize new chunk if needed
    if (!currentChunk) {
      currentChunk = {
        nodes: [],
        wordCount: 0,
        startPos: node.pos,
        endPos: node.pos,
        sectionPath: [...sectionStack],
        nodeTypes: new Set(),
      };
    }

    // Check if adding this node would exceed chunk size
    const wouldExceed = currentChunk.wordCount + nodeWordCount > MAX_WORDS_PER_CHUNK;
    const hasContent = currentChunk.nodes.length > 0;

    // Flush if we would exceed size and have content, unless it's a structural boundary
    if (wouldExceed && hasContent && !node.isStructuralBoundary) {
      flushChunk();
      
      // Start new chunk
      currentChunk = {
        nodes: [],
        wordCount: 0,
        startPos: node.pos,
        endPos: node.pos,
        sectionPath: [...sectionStack],
        nodeTypes: new Set(),
      };
    }

    // Add node to current chunk
    currentChunk.nodes.push(node);
    currentChunk.wordCount += nodeWordCount;
    currentChunk.endPos = node.pos;
    currentChunk.nodeTypes.add(node.type);
  }

  // Flush final chunk
  console.log("🏁 Final flush");
  flushChunk();

  console.log("✅ createSemanticChunks complete. Created", chunks.length, "chunks");
  return chunks;
}

/**
 * Generate preview text for a chunk
 */
export function generateChunkPreview(text: string): string {
  // Try to get first complete sentence
  const sentences = text.split(/(?<=[.!?])\s+/);
  const firstSentence = sentences[0]?.trim();
  
  if (firstSentence && firstSentence.length <= 120) {
    return firstSentence;
  }
  
  // Fallback to word boundary
  const words = text.split(/\s+/);
  let preview = "";
  for (const word of words) {
    if ((preview + " " + word).length > 120) break;
    preview += (preview ? " " : "") + word;
  }
  
  return preview + (preview.length < text.length ? "..." : "");
}

/**
 * Get chunks by index with lazy evaluation and context window
 */
export function getEscritoChunks(
  doc: Node,
  chunkIndex: number,
  contextWindow: number = 0
): ProcessedChunk[] {
  console.log("🔍 getEscritoChunks called with:", { chunkIndex, contextWindow });
  
  // Extract document structure
  const documentNodes = extractDocumentNodes(doc);
  console.log("📝 Extracted document nodes:", documentNodes.length, "nodes");
  
  if (documentNodes.length === 0) {
    console.log("❌ No document nodes found - returning empty array");
    return [];
  }

  // Create chunk metadata efficiently
  const chunkMetadata = createSemanticChunks(documentNodes);
  console.log("📊 Created chunks:", chunkMetadata.length, "chunks");
  
  if (chunkMetadata.length === 0) {
    console.log("❌ No chunks created - returning empty array");
    return [];
  }

  // Calculate context window bounds
  const start = Math.max(0, chunkIndex - contextWindow);
  const end = Math.min(chunkMetadata.length, chunkIndex + contextWindow + 1);
  console.log("🎯 Context window:", { start, end, totalChunks: chunkMetadata.length });
  
  // Only process chunks in the requested range
  const resultChunks: ProcessedChunk[] = [];
  
  for (let i = start; i < end; i++) {
    const metadata = chunkMetadata[i];
    console.log(`📄 Processing chunk ${i}:`, metadata);
    
    // Extract text for this chunk by finding nodes in position range
    const chunkNodes = documentNodes.filter(
      node => node.pos >= metadata.startPos && node.pos <= metadata.endPos
    );
    console.log(`📄 Chunk ${i} has ${chunkNodes.length} nodes in range`);
    
    const textParts: string[] = [];
    for (const node of chunkNodes) {
      if (node.type === "heading") {
        textParts.push(node.text.toUpperCase());
      } else {
        textParts.push(node.text);
      }
    }
    
    const text = textParts.join("\n\n");
    const wordCount = text.split(/\s+/).length;
    const preview = generateChunkPreview(text);
    
    console.log(`📄 Chunk ${i} text length:`, text.length, "words:", wordCount);
    
    resultChunks.push({
      ...metadata,
      text,
      preview,
      wordCount,
      hasMore: wordCount >= MAX_WORDS_PER_CHUNK * 0.95, // Indicate if chunk is near size limit
    });
  }

  console.log("✅ Returning", resultChunks.length, "chunks");
  return resultChunks;
}


/**
 * Get full Escrito text with proper structure preservation
 */
export const getFullEscrito = (doc: Node): { text: string; wordCount: number; structure: string[] } => {
  const documentNodes = extractDocumentNodes(doc);
  const textParts: string[] = [];
  const structure: string[] = [];
  
  for (const node of documentNodes) {
    if (node.type === "heading") {
      const headingText = node.text.toUpperCase();
      textParts.push(headingText);
      structure.push(`H${node.level || 1}: ${node.text}`);
    } else {
      textParts.push(node.text);
    }
  }
  
  const fullText = textParts.join("\n\n");
  const wordCount = fullText.split(/\s+/).length;
  
  return {
    text: fullText,
    wordCount,
    structure,
  };
}

const readEscritoTool = createTool({
  description: "Read an Escrito",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
    operation: z.enum(["outline", "chunk", "full"]).describe("The operation to perform"),
    chunkIndex: z.number().optional().describe("The chunk index to read"),
    contextWindow: z.number().optional().describe("The number of chunks before and after the target chunk to include"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: args.escritoId as any });
    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    if (args.operation === "outline") {
      return getEscritoOutline(doc.doc);
    } else if (args.operation === "chunk") {
      return getEscritoChunks(doc.doc, args.chunkIndex, args.contextWindow);
    } else if (args.operation === "full") {
      return getFullEscrito(doc.doc);
    }
  }
} as any);

export { readEscritoTool };