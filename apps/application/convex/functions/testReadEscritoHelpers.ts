import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";
import { 
  getEscritoChunks as getEscritoChunksNew, 
  getEscritoOutline as getEscritoOutlineNew,
  getFullEscrito as getFullEscritoNew 
} from "../agent/tools/escritos/readEscritoTool";

// Legacy functions removed - now using the redesigned implementations

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

    // Execute the requested operation using the redesigned functions
    if (args.operation === "outline") {
      const outlineResult = getEscritoOutlineNew(doc.doc);
      console.log("📋 Outline operation returned", outlineResult.length, "items");
      return outlineResult;
    } else if (args.operation === "chunk") {
      const chunkResult = getEscritoChunksNew(doc.doc, args.chunkIndex || 0, args.contextWindow || 1);
      console.log("📄 Chunk operation returned", chunkResult.length, "chunks");
      return chunkResult;
    } else if (args.operation === "full") {
      const fullResult = getFullEscritoNew(doc.doc);
      console.log("📖 Full operation returned document with", fullResult.wordCount, "words");
      return fullResult;
    }

    throw new Error(`Unknown operation: ${args.operation}`);
  },
});
