import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";
import { 
  getEscritoChunks as getEscritoChunksNew, 
  getEscritoOutline as getEscritoOutlineNew,
  getFullEscrito as getFullEscritoNew 
} from "../agent/tools/readEscritoTool";

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
      return getEscritoOutlineNew(doc.doc);
    } else if (args.operation === "chunk") {
      return getEscritoChunksNew(doc.doc, args.chunkIndex || 0, args.contextWindow || 1);
    } else if (args.operation === "full") {
      return getFullEscritoNew(doc.doc);
    }

    throw new Error(`Unknown operation: ${args.operation}`);
  },
});
