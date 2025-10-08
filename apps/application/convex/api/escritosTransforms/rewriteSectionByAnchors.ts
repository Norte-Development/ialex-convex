import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../../prosemirror";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { components } from "../../_generated/api";
import { EditorState } from "@tiptap/pm/state";
import { buildDocIndex, findAnchorPosition } from "../../agents/core/utils/normalizedSearch";
import { createParagraphNodesFromText } from "./helpers/prosemirrorHelpers";
import { getStandardSearchOptions } from "./helpers/searchHelpers";
import { applyDiffMerge } from "./helpers/diffHelpers";

/**
 * Rewrite a section of an Escrito identified by textual anchors, then merge via JSON diff.
 * - If both afterText and beforeText are provided, rewrites the range between them (exclusive of anchors).
 * - If only afterText is provided, rewrites from that anchor to the end of the document.
 * - If only beforeText is provided, rewrites from the start of the document up to that anchor.
 * - If neither is provided, rewrites the entire document.
 * 
 * Safety measures:
 * - Prevents overly broad replacements (>80% of document or >50k chars)
 * - Reduces context window for more precise anchor matching
 * - Attempts to narrow replacement ranges for large operations
 * - Falls back to insertion at end if replacement fails
 */
export const rewriteSectionByAnchors = mutation({
  args: {
    escritoId: v.id("escritos"),
    targetText: v.string(),
    anchors: v.object({
      afterText: v.optional(v.string()),
      beforeText: v.optional(v.string()),
      occurrenceIndex: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { escritoId, targetText, anchors }) => {
    const escrito = await ctx.db.get(escritoId);
    if (!escrito) throw new Error("Escrito not found");

    const snapshot = await ctx.runQuery(
      components.prosemirrorSync.lib.getSnapshot,
      {
        id: escrito.prosemirrorId,
      }
    );
    if (!snapshot?.content) throw new Error("Document content not found");

    const schema = buildServerSchema();

    await prosemirrorSync.transform(
      ctx,
      escrito.prosemirrorId,
      schema,
      (doc) => {
        const originalDocJson = doc.toJSON();
        const state = EditorState.create({ doc });
        let tr = state.tr;

        // Compute anchor positions using normalized index
        const docIndex = buildDocIndex(
          tr.doc,
          getStandardSearchOptions() as any
        );

        const searchOpts = {
          ...getStandardSearchOptions(false),
          contextWindow: 50, // Reduced context window for more precise matching
        } as any;

        const afterPos = anchors.afterText
          ? findAnchorPosition(
              docIndex,
              {
                afterText: anchors.afterText,
                occurrenceIndex: anchors.occurrenceIndex,
              },
              searchOpts
            )
          : null;
        const beforePos = anchors.beforeText
          ? findAnchorPosition(
              docIndex,
              {
                beforeText: anchors.beforeText,
                occurrenceIndex: anchors.occurrenceIndex,
              },
              searchOpts
            )
          : null;

        console.log("Anchor positioning debug:", {
          afterText: anchors.afterText,
          beforeText: anchors.beforeText,
          occurrenceIndex: anchors.occurrenceIndex,
          afterPos,
          beforePos,
          docSize: tr.doc.content.size,
        });

        let from = 0;
        let to = tr.doc.content.size;

        if (afterPos != null && beforePos != null) {
          from = Math.max(0, Math.min(afterPos, tr.doc.content.size));
          to = Math.max(0, Math.min(beforePos, tr.doc.content.size));
          if (from > to) {
            // Swap if anchors are reversed
            const tmp = from;
            from = to;
            to = tmp;
          }

          // Add safety checks to prevent overly broad replacements
          const docSize = tr.doc.content.size;
          const maxReplacementSize = Math.min(docSize * 0.8, 50000); // Max 80% of doc or 50k chars
          const replacementSize = to - from;

          if (replacementSize > maxReplacementSize) {
            console.log(
              `Warning: Replacement size ${replacementSize} exceeds maximum ${maxReplacementSize}. Skipping replacement.`
            );
            // Fallback: insert at the end instead of replacing
            from = docSize;
            to = docSize;
          }

          // Additional safety: If replacement would affect too much content, try to narrow the range
          if (
            replacementSize > 10000 &&
            anchors.afterText &&
            anchors.beforeText
          ) {
            console.log(
              `Large replacement detected (${replacementSize} chars). Attempting to narrow range.`
            );

            // Try to find more specific boundaries by looking for section markers
            const docText = tr.doc.textBetween(0, tr.doc.content.size);
            const afterMatch = docText.indexOf(
              anchors.afterText,
              afterPos - 1000
            );
            const beforeMatch = docText.indexOf(anchors.beforeText, afterPos);

            if (
              afterMatch !== -1 &&
              beforeMatch !== -1 &&
              beforeMatch > afterMatch
            ) {
              // Try to find the end of the current paragraph after the afterText
              const afterEnd = docText.indexOf(
                "\n\n",
                afterMatch + anchors.afterText.length
              );
              if (afterEnd !== -1 && afterEnd < beforeMatch) {
                const newFrom = Math.min(from, afterEnd + 2); // Include the paragraph break
                if (newFrom > from) {
                  console.log(
                    `Narrowed range from ${from}-${to} to ${newFrom}-${to}`
                  );
                  from = newFrom;
                }
              }
            }
          }
        } else if (afterPos != null) {
          from = Math.max(0, Math.min(afterPos, tr.doc.content.size));
          to = tr.doc.content.size;
        } else if (beforePos != null) {
          from = 0;
          to = Math.max(0, Math.min(beforePos, tr.doc.content.size));
        }

        console.log("Final replacement range:", {
          from,
          to,
          replacementSize: to - from,
          targetTextLength: targetText.length,
        });

        // Build replacement fragment
        const replacement = createParagraphNodesFromText(schema, targetText);

        try {
          tr = tr.replaceWith(from, to, replacement as any);
        } catch (e) {
          console.log("ReplaceWith failed, using fallback insert:", e);
          // Fallback: if replaceWith fails due to invalid positions, insert at end
          tr = tr.insert(tr.doc.content.size, replacement as any);
        }

        // Apply diff-based merge to preserve change tracking
        return applyDiffMerge(schema, doc, tr.doc);
      }
    );

    return {
      ok: true,
      message: "Section rewrite applied via anchors",
    };
  },
});
