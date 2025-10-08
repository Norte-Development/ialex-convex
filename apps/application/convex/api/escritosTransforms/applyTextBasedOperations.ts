import { mutation } from "../../../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../../lib/prosemirror/prosemirrorSync";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { components } from "../../../_generated/api";
import { EditorState } from "@tiptap/pm/state";
import {
  buildDocIndex,
  findMatches,
  selectByOccurrence,
  findAnchorPosition,
} from "../../agents/core/utils/normalizedSearch";
import { textBasedEditValidator } from "./types";
import {
  createTextContent,
  insertContentProperly,
  replaceContentProperly,
  createNodeOfType,
} from "./helpers/prosemirrorHelpers";
import {
  isWholeWordLikely,
  getStandardSearchOptions,
  getContextualSearchOptions,
} from "./helpers/searchHelpers";
import { applyDiffMerge } from "./helpers/diffHelpers";

/**
 * Apply text-based operations to an Escrito.
 * This mutation handles the conversion from text-based operations to position-based operations.
 */
export const applyTextBasedOperations = mutation({
  args: {
    escritoId: v.id("escritos"),
    edits: v.array(textBasedEditValidator),
  },
  handler: async (ctx, { escritoId, edits }) => {
    // Verify user has escrito write permission
    const escrito = await ctx.db.get(escritoId);
    if (!escrito) throw new Error("Escrito not found");

    // Get the current document content
    const documentContent = await ctx.runQuery(
      components.prosemirrorSync.lib.getSnapshot,
      {
        id: escrito.prosemirrorId,
      }
    );
    if (!documentContent?.content) {
      throw new Error("Document content not found");
    }

    // Build schema for the transform function
    const schema = buildServerSchema();

    const operations: any[] = [];

    // Process each edit using the existing ProseMirror sync system
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 PROCESSING EDITS IN MUTATION");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total edits to process: ${edits.length}`);
    console.log("Raw edits received:", JSON.stringify(edits, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const edit of edits) {
      console.log(`\n📝 Processing edit type: ${edit.type}`);

      if (edit.type === "replace") {
        console.log(`  findText: "${edit.findText}"`);
        console.log(`  replaceText: "${edit.replaceText}"`);
        console.log(`  contextBefore: "${edit.contextBefore}"`);
        console.log(`  contextAfter: "${edit.contextAfter}"`);

        operations.push({
          type: "replace_range",
          from: 0, // Will be calculated in the transform
          to: 0, // Will be calculated in the transform
          text: edit.replaceText,
          findText: edit.findText,
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          replaceAll: edit.replaceAll,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
        });

        console.log(`  Created operation:`, JSON.stringify(operations[operations.length - 1], null, 2));
      } else if (edit.type === "insert") {
        operations.push({
          type: "insert_text",
          pos: 0, // Will be calculated in the transform
          text: edit.insertText,
          afterText: edit.afterText,
          beforeText: edit.beforeText,
        });
      } else if (edit.type === "add_mark") {
        operations.push({
          type: "add_mark",
          text: edit.text,
          markType: edit.markType,
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
        });
      } else if (edit.type === "remove_mark") {
        operations.push({
          type: "remove_mark",
          text: edit.text,
          markType: edit.markType,
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
        });
      } else if (edit.type === "replace_mark") {
        operations.push({
          type: "replace_mark",
          text: edit.text,
          oldMarkType: edit.oldMarkType,
          newMarkType: edit.newMarkType,
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
        });
      } else if (edit.type === "add_paragraph") {
        operations.push({
          type: "add_paragraph",
          content: edit.content,
          paragraphType: edit.paragraphType,
          headingLevel: edit.headingLevel,
          afterText: edit.afterText,
          beforeText: edit.beforeText,
        });
      }
    }

    if (operations.length === 0) {
      return { message: "No changes to apply" };
    }

    // Apply the position-based operations using the existing mutation
    await prosemirrorSync.transform(
      ctx,
      escrito.prosemirrorId,
      schema,
      (doc) => {
        // Store original for diff
        let originalDocJson;
        try {
          originalDocJson = doc.toJSON();
        } catch (error) {
          throw error;
        }

        // Create a fresh state for applying operations
        let currentDoc = doc;

        // Apply operations one by one
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];

          let state;
          try {
            state = EditorState.create({ doc: currentDoc });
          } catch (error) {
            throw error;
          }

          let tr = state.tr;

          // Ensure document has content for operations
          if (currentDoc.childCount === 0) {
            try {
              const paragraph = schema.nodes.paragraph.createAndFill()!;
              tr = tr.insert(0, paragraph);
            } catch (error) {
              throw error;
            }
          }

          // Handle text-based operations with normalized, cross-node matching
          if (op.type === "replace_range" && op.findText) {
            console.log(`\n🔍 SEARCHING FOR TEXT: "${op.findText}"`);
            console.log(
              `  Context before: "${op.contextBefore || "none"}"`
            );
            console.log(
              `  Context after: "${op.contextAfter || "none"}"`
            );

            const docIndex = buildDocIndex(tr.doc, {
              ...getContextualSearchOptions(isWholeWordLikely(op.findText)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });

            console.log(
              `  Document index normalized text length: ${docIndex.normalizedText.length}`
            );
            console.log(
              `  Document index text preview (first 200 chars): "${docIndex.normalizedText.substring(0, 200)}..."`
            );
            console.log(`  Searching for findText in normalized text...`);

            const found = findMatches(docIndex, op.findText, {
              ...getContextualSearchOptions(isWholeWordLikely(op.findText)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });

            console.log(`  ✅ Found ${found.length} matches`);
            if (found.length > 0) {
              found.forEach((match, idx) => {
                console.log(
                  `    Match ${idx + 1}: from=${match.from}, to=${match.to}`
                );
              });
            }

            if (!found.length) {
              console.log(`  ⚠️  NO MATCHES FOUND - Skipping this operation`);
              continue;
            }

            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              !!op.replaceAll
            );
            if (!selected.length) continue;

            selected
              .slice()
              .reverse()
              .forEach((m) => {
                // If replaceText is empty, just delete the range (don't create empty text nodes)
                if (op.text === "" || op.text.length === 0) {
                  tr = tr.delete(m.from, m.to);
                } else {
                  // Use createTextContent to properly handle newlines
                  const replacementContent = createTextContent(schema, op.text);
                  if (replacementContent !== null) {
                    tr = replaceContentProperly(
                      tr,
                      m.from,
                      m.to,
                      replacementContent
                    );
                  } else {
                    // If createTextContent returns null (empty content), delete the range
                    tr = tr.delete(m.from, m.to);
                  }
                }
              });
          } else if (
            op.type === "insert_text" &&
            (op.afterText || op.beforeText)
          ) {
            const docIndex = buildDocIndex(
              tr.doc,
              getStandardSearchOptions()
            );
            const anchor = findAnchorPosition(
              docIndex,
              { afterText: op.afterText, beforeText: op.beforeText },
              {
                ...getStandardSearchOptions(
                  (!!op.afterText && isWholeWordLikely(op.afterText)) ||
                    (!!op.beforeText && isWholeWordLikely(op.beforeText))
                ),
              }
            );
            if (anchor == null) continue;
            // Use createTextContent to properly handle newlines
            const insertionContent = createTextContent(schema, op.text);
            if (insertionContent !== null) {
              tr = insertContentProperly(tr, anchor, insertionContent);
            }
          } else if (op.type === "add_mark") {
            // Validate mark type exists in schema
            if (!schema.marks[op.markType]) {
              continue;
            }

            const docIndex = buildDocIndex(tr.doc, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            const found = findMatches(docIndex, op.text, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              false
            );
            if (!selected.length) continue;
            selected
              .slice()
              .reverse()
              .forEach((m) => {
                const mark = schema.marks[op.markType].create();
                tr = tr.addMark(m.from, m.to, mark);
              });
          } else if (op.type === "remove_mark") {
            // Validate mark type exists in schema
            if (!schema.marks[op.markType]) {
              continue;
            }

            const docIndex = buildDocIndex(tr.doc, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            const found = findMatches(docIndex, op.text, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              false
            );
            if (!selected.length) continue;
            selected
              .slice()
              .reverse()
              .forEach((m) => {
                const mark = schema.marks[op.markType].create();
                tr = tr.removeMark(m.from, m.to, mark);
              });
          } else if (op.type === "replace_mark") {
            // Validate mark types exist in schema
            if (!schema.marks[op.oldMarkType]) {
              continue;
            }
            if (!schema.marks[op.newMarkType]) {
              continue;
            }

            const docIndex = buildDocIndex(tr.doc, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            const found = findMatches(docIndex, op.text, {
              ...getContextualSearchOptions(isWholeWordLikely(op.text)),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              false
            );
            if (!selected.length) continue;
            selected
              .slice()
              .reverse()
              .forEach((m) => {
                const oldMark = schema.marks[op.oldMarkType].create();
                const newMark = schema.marks[op.newMarkType].create();
                tr = tr
                  .removeMark(m.from, m.to, oldMark)
                  .addMark(m.from, m.to, newMark);
              });
          } else if (op.type === "add_paragraph") {
            // Validate node type exists in schema
            if (!schema.nodes[op.paragraphType]) {
              continue;
            }

            // Validate heading level if adding heading
            if (
              op.paragraphType === "heading" &&
              op.headingLevel &&
              (op.headingLevel < 1 || op.headingLevel > 6)
            ) {
              continue;
            }

            // Find insertion position using normalized anchors first
            let insertPos = 0;
            if (op.afterText || op.beforeText) {
              const docIndex = buildDocIndex(
                tr.doc,
                getStandardSearchOptions()
              );
              const anchor = findAnchorPosition(
                docIndex,
                { afterText: op.afterText, beforeText: op.beforeText },
                {
                  ...getStandardSearchOptions(
                    (!!op.afterText && isWholeWordLikely(op.afterText)) ||
                      (!!op.beforeText && isWholeWordLikely(op.beforeText))
                  ),
                }
              );
              insertPos = anchor != null ? anchor : tr.doc.content.size;
            } else {
              insertPos = tr.doc.content.size;
            }

            // Create the new node
            const newNode = createNodeOfType(
              schema,
              op.paragraphType,
              op.content,
              op.headingLevel
            );
            tr = tr.insert(insertPos, newNode);
          } else {
            // Fallback to original position-based logic for regular operations
            const docSize = tr.doc.content.size;

            if (op.type === "insert_text" && typeof op.pos === "number") {
              if (op.pos >= 0 && op.pos <= docSize) {
                // Use createTextContent to properly handle newlines
                const insertionContent = createTextContent(schema, op.text);
                if (insertionContent !== null) {
                  tr = insertContentProperly(tr, op.pos, insertionContent);
                }
              }
            } else if (
              op.type === "replace_range" &&
              typeof op.from === "number" &&
              typeof op.to === "number"
            ) {
              if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
                // If replaceText is empty, just delete the range
                if (op.text === "" || op.text.length === 0) {
                  tr = tr.delete(op.from, op.to);
                } else {
                  // Use createTextContent to properly handle newlines
                  const replacementContent = createTextContent(schema, op.text);
                  if (replacementContent !== null) {
                    tr = replaceContentProperly(
                      tr,
                      op.from,
                      op.to,
                      replacementContent
                    );
                  } else {
                    // If createTextContent returns null (empty content), delete the range
                    tr = tr.delete(op.from, op.to);
                  }
                }
              }
            }
          }

          // Update current document for next iteration
          currentDoc = tr.doc;
        }

        // Apply diff-based merge to preserve change tracking
        return applyDiffMerge(schema, doc, currentDoc);
      }
    );

    return {
      ok: true,
      message: `Applied ${operations.length} operations successfully`,
      operationsApplied: operations.length,
    };
  },
});
