import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../_generated/api";
import { z } from "zod";

export const getEscritoTool = createTool({
  description: "Get the content of an Escrito",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.escritoId || typeof args.escritoId !== 'string' || args.escritoId.trim().length === 0) {
      throw new Error("Invalid escritoId: must be a non-empty string");
    }

    const escritoId = args.escritoId.trim();

    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: escritoId as any });

    if (!escrito) {
      throw new Error(`Escrito not found with ID: ${escritoId}`);
    }

    console.log("escrito", escrito);

    // Get the actual document content using prosemirror
    const documentContent = await ctx.runQuery(api.prosemirror.getSnapshot, { id: escrito.prosemirrorId });

    return {
      content: documentContent
    };
  }
} as any);
