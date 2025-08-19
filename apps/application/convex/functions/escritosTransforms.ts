import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { requireEscritoPermission } from "../auth_utils";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { createJsonDiff, buildContentWithJsonChanges } from "../../../../packages/shared/src/diff/jsonDiff";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";

type Operation =
  | { type: "insert_text"; pos: number; text: string }
  | { type: "replace_range"; from: number; to: number; text: string };

export const applyEscritoOperations = mutation({
  args: {
    escritoId: v.id("escritos"),
    operations: v.array(v.object({
      type: v.union(v.literal("insert_text"), v.literal("replace_range")),
      pos: v.optional(v.number()),
      from: v.optional(v.number()),
      to: v.optional(v.number()),
      text: v.string(),
    })),
  },
  handler: async (ctx, { escritoId, operations }) => {
    const escrito = await ctx.db.get(escritoId);
    if (!escrito) throw new Error("Escrito not found");
    // await requireEscritoPermission(ctx, escrito.caseId, "write");

    const schema = buildServerSchema();

    await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (doc) => {
      // Build an EditorState to apply raw ops and derive proposed new JSON
      const state: EditorState = EditorState.create({ doc });
      let tr = state.tr;

      // If document is effectively empty, ensure it has a first paragraph to accept inserts
      if (doc.childCount === 0) {
        const paragraph = schema.nodes.paragraph.createAndFill()!;
        tr = tr.insert(0, paragraph);
      }

      for (const op of operations) {
        if (op.type === "insert_text" && typeof op.pos === "number") {
          tr = tr.insertText(op.text, Math.max(0, op.pos));
        } else if (op.type === "replace_range" && typeof op.from === "number" && typeof op.to === "number") {
          tr = tr.insertText(op.text, Math.max(0, op.from), Math.max(0, op.to));
        }
      }

      const newDocJson = tr.doc.toJSON();
      const oldDocJson = doc.toJSON();

      const delta = createJsonDiff(oldDocJson, newDocJson);
      const merged = buildContentWithJsonChanges(oldDocJson, newDocJson, delta);
      console.log("merged", merged);

      const mergedNode = schema.nodeFromJSON(merged);
      // Create a transaction that replaces the entire document content with the merged content
      const finalState = EditorState.create({ doc });
      let finalTr = finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);
      return finalTr;
    });

    return { ok: true };
  },
});


