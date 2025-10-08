import { action } from "../../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../../prosemirror";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { internal, components } from "../../_generated/api";
import { EditorState } from "@tiptap/pm/state";
import { buildDocIndex, findMatches } from "../../agents/core/utils/normalizedSearch";
import { getStandardSearchOptions } from "./helpers/searchHelpers";
import { applyDiffMerge } from "./helpers/diffHelpers";

/**
 * Insert HTML content into an Escrito at various positions.
 * Positions supported:
 * - documentStart: Insert at the beginning of the document
 * - documentEnd: Insert at the end of the document
 * - range: Replace the content between textStart (exclusive) and textEnd (exclusive). Anchors are not modified.
 * - position: Insert at an absolute ProseMirror position (integer)
 */
export const insertHtmlContent = action({
  args: {
    escritoId: v.id("escritos"),
    html: v.string(),
    placement: v.union(
      v.object({ type: v.literal("documentStart") }),
      v.object({ type: v.literal("documentEnd") }),
      v.object({
        type: v.literal("range"),
        textStart: v.string(),
        textEnd: v.string(),
      }),
      v.object({ type: v.literal("position"), position: v.number() })
    ),
  },
  handler: async (ctx, { escritoId, html, placement }) => {
    const escrito = await ctx.runQuery(
      internal.functions.documents.internalGetEscrito,
      { escritoId }
    );
    if (!escrito) throw new Error("Escrito not found");

    const snapshot = await ctx.runQuery(
      components.prosemirrorSync.lib.getSnapshot,
      {
        id: escrito.prosemirrorId,
      }
    );
    if (!snapshot?.content) throw new Error("Document content not found");

    const schema = buildServerSchema();

    // Parse HTML in Node action and deserialize here
    const htmlJsonStr: string = await ctx.runAction(
      internal.functions.html.parseHtmlToTiptapJson,
      { html }
    );
    const htmlJson = JSON.parse(htmlJsonStr);
    const htmlDocNode = schema.nodeFromJSON(htmlJson);

    await prosemirrorSync.transform(
      ctx,
      escrito.prosemirrorId,
      schema,
      (doc) => {
        const state = EditorState.create({ doc });
        let tr = state.tr;

        const docSize = tr.doc.content.size;

        const insertFragment = htmlDocNode.content; // PM Fragment

        const doSafeInsert = (pos: number) => {
          const clamped = Math.max(0, Math.min(pos, tr.doc.content.size));
          try {
            tr = tr.insert(clamped, insertFragment);
          } catch (e) {
            // Fallback: insert at end
            tr = tr.insert(tr.doc.content.size, insertFragment);
          }
        };

        if (placement.type === "documentStart") {
          doSafeInsert(0);
        } else if (placement.type === "documentEnd") {
          doSafeInsert(tr.doc.content.size);
        } else if (placement.type === "position") {
          if (
            typeof placement.position !== "number" ||
            placement.position < 0 ||
            placement.position > docSize
          ) {
            // Clamp instead of throwing
            doSafeInsert(Math.max(0, Math.min(placement.position ?? 0, docSize)));
          } else {
            doSafeInsert(placement.position);
          }
        } else if (placement.type === "range") {
          const searchOpts = {
            ...getStandardSearchOptions(false),
            contextWindow: 50,
          } as any;

          // Build normalized index and find anchors
          const docIndex = buildDocIndex(tr.doc, searchOpts);
          const starts = findMatches(docIndex, placement.textStart, searchOpts);
          const ends = findMatches(docIndex, placement.textEnd, searchOpts);

          if (!starts.length || !ends.length) {
            // Nothing to do if anchors not found
            return state.tr; // no-op
          }

          // Choose first start, then first end after start
          const startPos = starts[0].to; // exclusive of start anchor
          const endCandidate = ends.find((m) => m.from > startPos);
          const endPos = endCandidate ? endCandidate.from : ends[0].from;

          let from = Math.max(0, Math.min(startPos, tr.doc.content.size));
          let to = Math.max(0, Math.min(endPos, tr.doc.content.size));
          if (from > to) {
            const tmp = from;
            from = to;
            to = tmp;
          }

          try {
            tr = tr.replaceWith(from, to, insertFragment);
          } catch (e) {
            // Fallback: insert at end
            tr = tr.insert(tr.doc.content.size, insertFragment);
          }
        }

        // Apply diff-based merge to preserve change tracking
        return applyDiffMerge(schema, doc, tr.doc);
      }
    );

    return {
      ok: true,
      message: "HTML content inserted",
    };
  },
});
