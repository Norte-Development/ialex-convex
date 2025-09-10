import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";

interface Chunk {
  chunkIndex: number;
  text: string;
  preview: string;
  wordCount: number;
  sectionTitle?: string;
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

export function getEscritoChunks(
  doc: Node,
  chunkIndex: number,
  contextWindow: number = 0
): Chunk[] {
  const allChunks: Chunk[] = [];
  let currChunkText: string[] = [];
  let currWordCount = 0;
  let sectionTitle: string | undefined;

  const flushChunk = () => {
    if (currChunkText.length === 0) return;
    const text = currChunkText.join("\n\n").trim();
    const words = text.split(/\s+/).length;
    const preview =
      text.split(/(?<=[.?!])\s+/)[0]?.slice(0, 120) ?? text.slice(0, 120);

    allChunks.push({
      chunkIndex: allChunks.length,
      text,
      preview,
      wordCount: words,
      sectionTitle,
    });

    currChunkText = [];
    currWordCount = 0;
  };

  doc.content.forEach((node) => {
    if (node.type.name === "heading") {
      // Flush current chunk before starting a new section
      flushChunk();
      sectionTitle = node.textContent.trim();
    }

    if (["paragraph", "heading", "list_item"].includes(node.type.name)) {
      const blockText = node.textContent.trim();
      if (!blockText) return;

      const words = blockText.split(/\s+/).length;

      // If adding this block would exceed chunk size → flush first
      if (currWordCount > 0 && currWordCount + words > MAX_WORDS_PER_CHUNK) {
        flushChunk();
      }

      currChunkText.push(
        node.type.name === "heading"
          ? `${blockText.toUpperCase()}`
          : blockText
      );
      currWordCount += words;
    }
  });

  // Flush any remaining text
  flushChunk();

  // Apply context windowing: include contextWindow chunks before and after the target chunk
  const start = Math.max(0, chunkIndex - contextWindow);
  const end = Math.min(allChunks.length, chunkIndex + contextWindow + 1);

  console.log("allChunks", allChunks.slice(start, end));

  return allChunks.slice(start, end);
}

const getFullEscrito = (doc: Node) => {
  // For now, return the full text content
  return doc.textContent;
}

export const testReadEscritoHelpers = mutation({
  args: {
    escritoId: v.id("escritos"),
    operation: v.union(v.literal("outline"), v.literal("chunk"), v.literal("full")),
    chunkIndex: v.optional(v.number()),
    contextWindow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the escrito
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Get the ProseMirror document
    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());

    // Execute the requested operation
    if (args.operation === "outline") {
      return getEscritoOutline(doc.doc);
    } else if (args.operation === "chunk") {
      return getEscritoChunks(doc.doc, args.chunkIndex || 0, args.contextWindow || 1);
    } else if (args.operation === "full") {
      return getFullEscrito(doc.doc);
    }

    throw new Error(`Unknown operation: ${args.operation}`);
  },
});
