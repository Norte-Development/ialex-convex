import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../_generated/api";
import { z } from "zod";
import { prosemirrorSync } from "../../prosemirror";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";

export const getEscritoStatsTool = createTool({
  description: "Get the stats of an Escrito",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: args.escritoId as any });
    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    const stats = {
        words: countWords(doc),
        paragraphs: countParagraphs(doc),
    }
    return { 
        stats,
        escritoId: escrito._id,
        version: doc.version,
    };
  }
} as any);

const countWords = (doc: { version: number; doc: Node }) => {
    let count = 0;

    doc.doc.content.descendants((node, pos) => {
        if (node.isText && node.text) {
            count += node.text.split(/\s+/).length;
        }
    });

    return count;
}

const countParagraphs = (doc: { version: number; doc: Node }) => {
    let count = 0;

    doc.doc.content.descendants((node, pos) => {
        if (node.type.name === "paragraph") {
            count++;
        }
    });

    return count;
}