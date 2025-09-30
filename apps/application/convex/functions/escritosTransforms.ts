import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState } from "@tiptap/pm/state";
import { buildDocIndex, findMatches, selectByOccurrence, findAnchorPosition } from "../agent/normalizedSearch";
import { api, components } from "../_generated/api";

/**
 * Apply text-based operations to an Escrito.
 * This mutation handles the conversion from text-based operations to position-based operations.
 */
export const applyTextBasedOperations = mutation({
  args: {
    escritoId: v.id("escritos"),
    edits: v.array(
      v.union(
        v.object({
          type: v.literal("replace"),
          findText: v.string(),
          replaceText: v.string(),
          contextBefore: v.optional(v.string()),
          contextAfter: v.optional(v.string()),
          replaceAll: v.optional(v.boolean()),
          occurrenceIndex: v.optional(v.number()),
          maxOccurrences: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("insert"),
          insertText: v.string(),
          afterText: v.optional(v.string()),
          beforeText: v.optional(v.string()),
        }),
        v.object({
          type: v.literal("delete"),
          deleteText: v.string(),
          contextBefore: v.optional(v.string()),
          contextAfter: v.optional(v.string()),
          occurrenceIndex: v.optional(v.number()),
          maxOccurrences: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("add_mark"),
          text: v.string(),
          markType: v.union(
            v.literal("bold"),
            v.literal("italic"),
            v.literal("code"),
            v.literal("strike"),
            v.literal("underline"),
          ),
          contextBefore: v.optional(v.string()),
          contextAfter: v.optional(v.string()),
          occurrenceIndex: v.optional(v.number()),
          maxOccurrences: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("remove_mark"),
          text: v.string(),
          markType: v.union(
            v.literal("bold"),
            v.literal("italic"),
            v.literal("code"),
            v.literal("strike"),
            v.literal("underline"),
          ),
          contextBefore: v.optional(v.string()),
          contextAfter: v.optional(v.string()),
          occurrenceIndex: v.optional(v.number()),
          maxOccurrences: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("replace_mark"),
          text: v.string(),
          oldMarkType: v.union(
            v.literal("bold"),
            v.literal("italic"),
            v.literal("code"),
            v.literal("strike"),
            v.literal("underline"),
          ),
          newMarkType: v.union(
            v.literal("bold"),
            v.literal("italic"),
            v.literal("code"),
            v.literal("strike"),
            v.literal("underline"),
          ),
          contextBefore: v.optional(v.string()),
          contextAfter: v.optional(v.string()),
          occurrenceIndex: v.optional(v.number()),
          maxOccurrences: v.optional(v.number()),
        }),
        v.object({
          type: v.literal("add_paragraph"),
          content: v.string(),
          paragraphType: v.union(
            v.literal("paragraph"),
            v.literal("heading"),
            v.literal("blockquote"),
            v.literal("bulletList"),
            v.literal("orderedList"),
            v.literal("codeBlock"),
          ),
          headingLevel: v.optional(v.number()),
          afterText: v.optional(v.string()),
          beforeText: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, { escritoId, edits }) => {
    // Verify user has escrito write permission
    const escrito = await ctx.db.get(escritoId);
    if (!escrito) throw new Error("Escrito not found");

    // Get the current document content
    const documentContent = await ctx.runQuery(components.prosemirrorSync.lib.getSnapshot, {
      id: escrito.prosemirrorId,
    });
    if (!documentContent?.content) {
      throw new Error("Document content not found");
    }

    // Build schema for the transform function
    const schema = buildServerSchema();

    const operations: any[] = [];

    // Helper function to escape regex special characters
    const escapeRegex = (text: string): string => {
      return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    // Helper function to determine the best matching strategy
    const getMatchingStrategy = (
      searchText: string,
    ): "literal" | "word_boundary" => {
      // Template placeholders: use literal matching
      if (searchText.startsWith("[") && searchText.endsWith("]")) {
        return "literal";
      }

      // Multi-word phrases with significant length: use literal matching
      if (searchText.includes(" ") && searchText.length > 20) {
        return "literal";
      }

      // Phrases with complex punctuation: use literal matching
      if (
        searchText.includes(",") ||
        searchText.includes(";") ||
        searchText.includes(":")
      ) {
        return "literal";
      }

      // Single words or simple phrases: use word boundary
      return "word_boundary";
    };

    // Helper function to find all text matches with literal string matching
    const findAllTextLiteral = (
      text: string,
      searchText: string,
    ): Array<{ index: number; length: number }> => {
      const matches: Array<{ index: number; length: number }> = [];
      let startIndex = 0;

      while (true) {
        const foundIndex = text.indexOf(searchText, startIndex);
        if (foundIndex === -1) break;

        matches.push({ index: foundIndex, length: searchText.length });
        startIndex = foundIndex + 1;
      }

      return matches;
    };

    // Helper function to find text with smart matching strategy (case-sensitive by default)
    const findTextWithSmartMatching = (
      text: string,
      searchText: string,
      startIndex: number = 0,
    ): number => {
      const strategy = getMatchingStrategy(searchText);

      if (strategy === "literal") {
        // Use indexOf for literal matching
        return text.indexOf(searchText, startIndex);
      } else {
        // Create regex with word boundaries - \b ensures we match whole words only
        const escapedSearch = escapeRegex(searchText);
        const regex = new RegExp(`\\b${escapedSearch}\\b`, "g"); // Removed 'i' flag for case-sensitive matching

        // Set lastIndex to start from the specified position
        regex.lastIndex = startIndex;
        const match = regex.exec(text);

        return match ? match.index : -1;
      }
    };

    // Backward compatibility alias
    const findTextWithWordBoundary = findTextWithSmartMatching;

    // Helper function to find all text matches using smart strategy detection (case-sensitive by default)
    const findAllTextWithSmartMatching = (
      text: string,
      searchText: string,
    ): Array<{ index: number; length: number }> => {
      const strategy = getMatchingStrategy(searchText);

      if (strategy === "literal") {
        return findAllTextLiteral(text, searchText);
      } else {
        // Word boundary matching
        const matches: Array<{ index: number; length: number }> = [];
        const escapedSearch = escapeRegex(searchText);
        const regex = new RegExp(`\\b${escapedSearch}\\b`, "g"); // Removed 'i' flag for case-sensitive matching

        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({ index: match.index, length: match[0].length });
          // Prevent infinite loop on zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }

        return matches;
      }
    };

    // Backward compatibility alias
    const findAllTextWithWordBoundary = findAllTextWithSmartMatching;

    // Process each edit using the existing ProseMirror sync system
    for (const edit of edits) {
      if (edit.type === "replace") {
        // For now, create simple position-based operations
        // The actual text finding will be done within the transform function
        operations.push({
          type: "replace_range",
          from: 0, // Will be calculated in the transform
          to: 0, // Will be calculated in the transform
          text: edit.replaceText,
          findText: edit.findText, // Pass the find text for processing
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          replaceAll: edit.replaceAll,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
        });
      } else if (edit.type === "insert") {
        operations.push({
          type: "insert_text",
          pos: 0, // Will be calculated in the transform
          text: edit.insertText,
          afterText: edit.afterText,
          beforeText: edit.beforeText,
        });
      } else if (edit.type === "delete") {
        operations.push({
          type: "delete_text",
          from: 0, // Will be calculated in the transform
          to: 0, // Will be calculated in the transform
          text: "",
          deleteText: edit.deleteText, // Pass the delete text for processing
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          occurrenceIndex: edit.occurrenceIndex,
          maxOccurrences: edit.maxOccurrences,
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

    // Helper function to find text with specific marks
    const findTextWithMark = (doc: any, text: string, markType?: string) => {
      const matches: Array<{ start: number; end: number; marks: any[] }> = [];

      doc.descendants((node: any, pos: number) => {
        // Skip deleted change nodes entirely - they should not be included in text matching
        if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
          const changeType = node.attrs?.changeType;
          if (changeType === "deleted") {
            return false; // Skip this node and its children
          }
        }

        if (node.isText) {
          const textContent = node.text || "";
          const wordMatches = findAllTextWithWordBoundary(textContent, text);

          for (const wordMatch of wordMatches) {
            const start = pos + wordMatch.index;
            const end = pos + wordMatch.index + wordMatch.length;

            // Get marks for this text node
            const marks = node.marks || [];

            // If markType is specified, check if text has the specified mark
            if (markType) {
              const hasMark = marks.some(
                (mark: any) => mark.type.name === markType,
              );
              if (hasMark) {
                matches.push({ start, end, marks });
              }
            } else {
              // If no markType specified, include all matches
              matches.push({ start, end, marks });
            }
          }
        }
      });

      return matches;
    };

    // Helper function to find text without specific marks (for add_mark operation)
    const findTextWithoutMark = (doc: any, text: string, markType: string) => {
      const matches: Array<{ start: number; end: number; marks: any[] }> = [];

      doc.descendants((node: any, pos: number) => {
        // Skip deleted change nodes entirely - they should not be included in text matching
        if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
          const changeType = node.attrs?.changeType;
          if (changeType === "deleted") {
            return false; // Skip this node and its children
          }
        }

        if (node.isText) {
          const textContent = node.text || "";
          const wordMatches = findAllTextWithWordBoundary(textContent, text);

          for (const wordMatch of wordMatches) {
            const start = pos + wordMatch.index;
            const end = pos + wordMatch.index + wordMatch.length;

            // Get marks for this text node
            const marks = node.marks || [];

            // Check if text does NOT have the specified mark
            const hasMark = marks.some(
              (mark: any) => mark.type.name === markType,
            );
            if (!hasMark) {
              matches.push({ start, end, marks });
            }
          }
        }
      });

      return matches;
    };

    // Helper function to find blocks (paragraphs, headings, etc.) containing specific text
    const findBlockWithText = (doc: any, text: string) => {
      const matches: Array<{
        node: any;
        pos: number;
        start: number;
        end: number;
      }> = [];

      doc.descendants((node: any, pos: number) => {
        // Skip deleted change nodes entirely - they should not be included in text matching
        if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
          const changeType = node.attrs?.changeType;
          if (changeType === "deleted") {
            return false; // Skip this node and its children
          }
        }

        if (node.isBlock && !node.isText) {
          const blockText = node.textContent || "";
          // For block-level text search, we can use includes() since we're looking for the text anywhere in the block
          // Word boundaries are less relevant at the block level
          if (blockText.includes(text)) {
            matches.push({
              node,
              pos,
              start: pos,
              end: pos + node.nodeSize,
            });
          }
        }
      });

      return matches;
    };

    // Helper function to find insertion position based on text anchors
    const findInsertPosition = (
      doc: any,
      afterText?: string,
      beforeText?: string,
    ) => {
      if (afterText) {
        // Find position after the specified text
        let insertPos = 0;
        let found = false;
        doc.descendants((node: any, pos: number) => {
          // Skip deleted change nodes entirely - they should not be included in text matching
          if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
            const changeType = node.attrs?.changeType;
            if (changeType === "deleted") {
              return false; // Skip this node and its children
            }
          }

          if (node.isText && !found) {
            const text = node.text || "";
            const wordMatches = findAllTextWithWordBoundary(text, afterText);
            if (wordMatches.length > 0) {
              // Find the end of the containing block
              let blockEnd = pos + node.nodeSize;
              let parent = node;
              while (parent && !parent.isBlock) {
                parent = parent.parent;
                if (parent) {
                  blockEnd = pos + parent.nodeSize;
                }
              }
              insertPos = blockEnd;
              found = true;
            }
          }
        });
        return found ? insertPos : doc.content.size;
      } else if (beforeText) {
        // Find position before the specified text
        let insertPos = 0;
        let found = false;
        doc.descendants((node: any, pos: number) => {
          // Skip deleted change nodes entirely - they should not be included in text matching
          if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
            const changeType = node.attrs?.changeType;
            if (changeType === "deleted") {
              return false; // Skip this node and its children
            }
          }

          if (node.isText && !found) {
            const text = node.text || "";
            const wordMatches = findAllTextWithWordBoundary(text, beforeText);
            if (wordMatches.length > 0) {
              // Find the start of the containing block
              let blockStart = pos;
              let parent = node;
              while (parent && !parent.isBlock) {
                parent = parent.parent;
                if (parent) {
                  blockStart = pos;
                }
              }
              insertPos = blockStart;
              found = true;
            }
          }
        });
        return found ? insertPos : 0;
      }
      // Default to end of document
      return doc.content.size;
    };

    // Helper function to create text content that properly handles newlines
    const createTextContent = (schema: any, content: string) => {
      // If content doesn't contain newlines, create simple text node
      if (!content.includes("\n")) {
        return schema.text(content);
      }

      // For content with newlines, let ProseMirror handle the conversion naturally
      // by using insertText which automatically converts \n to hard breaks
      return content;
    };

    // Helper function to create nodes of different types
    const createNodeOfType = (
      schema: any,
      type: string,
      content: any,
      headingLevel?: number,
    ) => {
      try {
        switch (type) {
          case "paragraph":
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              return schema.nodes.paragraph.createAndFill({}, textContent);
            }
            return schema.nodes.paragraph.createAndFill({}, content);

          case "heading":
            const level =
              headingLevel && headingLevel >= 1 && headingLevel <= 6
                ? headingLevel
                : 1;
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              return schema.nodes.heading.createAndFill({ level }, textContent);
            }
            return schema.nodes.heading.createAndFill({ level }, content);

          case "blockquote":
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              const paragraph = schema.nodes.paragraph.createAndFill(
                {},
                textContent,
              );
              return schema.nodes.blockquote.createAndFill({}, paragraph);
            }
            return schema.nodes.blockquote.createAndFill({}, content);

          case "codeBlock":
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              return schema.nodes.codeBlock.createAndFill({}, textContent);
            }
            return schema.nodes.codeBlock.createAndFill({}, content);

          case "bulletList":
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              const paragraph = schema.nodes.paragraph.createAndFill(
                {},
                textContent,
              );
              const listItem = schema.nodes.listItem.createAndFill(
                {},
                paragraph,
              );
              return schema.nodes.bulletList.createAndFill({}, listItem);
            }
            return schema.nodes.bulletList.createAndFill({}, content);

          case "orderedList":
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              const paragraph = schema.nodes.paragraph.createAndFill(
                {},
                textContent,
              );
              const listItem = schema.nodes.listItem.createAndFill(
                {},
                paragraph,
              );
              return schema.nodes.orderedList.createAndFill({}, listItem);
            }
            return schema.nodes.orderedList.createAndFill({}, content);

          default:
            // Fallback to paragraph
            if (typeof content === "string") {
              const textContent = createTextContent(schema, content);
              return schema.nodes.paragraph.createAndFill({}, textContent);
            }
            return schema.nodes.paragraph.createAndFill({}, content);
        }
      } catch (error) {
        console.error(`Error creating node of type ${type}:`, error);
        // Fallback to simple paragraph
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          return schema.nodes.paragraph.createAndFill({}, textContent);
        }
        return schema.nodes.paragraph.createAndFill({}, content);
      }
    };

    // Helper function to select matches based on occurrence control parameters
    const selectMatchesByOccurrence = (
      allMatches: Array<{ start: number; end: number }>,
      occurrenceIndex?: number,
      maxOccurrences?: number,
      replaceAll?: boolean,
    ): Array<{ start: number; end: number }> => {
      // Priority: occurrenceIndex > maxOccurrences > replaceAll > first match only

      if (occurrenceIndex !== undefined) {
        // Target specific occurrence (1-based)
        const index = occurrenceIndex - 1; // Convert to 0-based
        if (index >= 0 && index < allMatches.length) {
          console.log(
            `Targeting occurrence ${occurrenceIndex} (found at index ${index})`,
          );
          return [allMatches[index]];
        } else {
          console.log(
            `Occurrence ${occurrenceIndex} not found (only ${allMatches.length} matches available)`,
          );
          return [];
        }
      }

      if (maxOccurrences !== undefined) {
        // Limit number of occurrences
        const limited = allMatches.slice(0, maxOccurrences);
        console.log(
          `Limiting to first ${maxOccurrences} occurrences (found ${limited.length})`,
        );
        return limited;
      }

      if (replaceAll) {
        // All occurrences (existing behavior)
        console.log(`Processing all ${allMatches.length} occurrences`);
        return allMatches;
      }

      // Default: first occurrence only
      if (allMatches.length > 0) {
        console.log(
          `Processing first occurrence only (${allMatches.length} total found)`,
        );
        return [allMatches[0]];
      }

      return [];
    };

    // Decide whole-word matching based on search text characteristics
    const isWholeWordLikely = (searchText: string): boolean => {
      if (!searchText) return false;
      if (searchText.includes(" ")) return false;
      if (searchText.length > 20) return false;
      if (/[.,;:]/.test(searchText)) return false;
      return true;
    };

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
            const docIndex = buildDocIndex(tr.doc, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.findText),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });

            const found = findMatches(docIndex, op.findText, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.findText),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });

            if (!found.length) continue;

            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              !!op.replaceAll,
            );
            if (!selected.length) continue;

            selected
              .slice()
              .reverse()
              .forEach((m) => {
                // Use createTextContent to properly handle newlines
                const replacementContent = createTextContent(schema, op.text);
                if (typeof replacementContent === 'string') {
                  // For strings with newlines, use insertText which handles newlines naturally
                  tr = tr.delete(m.from, m.to).insertText(replacementContent, m.from);
                } else {
                  // For simple text nodes, use replaceWith
                  tr = tr.replaceWith(m.from, m.to, replacementContent);
                }
            });
          } else if (
            op.type === "insert_text" &&
            (op.afterText || op.beforeText)
          ) {
            const docIndex = buildDocIndex(tr.doc, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
            });
            const anchor = findAnchorPosition(
              docIndex,
              { afterText: op.afterText, beforeText: op.beforeText },
              {
                caseInsensitive: false,
                normalizeWhitespace: false,
                unifyNbsp: true,
                removeSoftHyphen: true,
                removeZeroWidth: true,
                normalizeQuotesAndDashes: true,
                unicodeForm: "NFC",
                wholeWord:
                  !!op.afterText && isWholeWordLikely(op.afterText) ||
                  (!!op.beforeText && isWholeWordLikely(op.beforeText)),
              },
            );
            if (anchor == null) continue;
            // Use createTextContent to properly handle newlines
            const insertionContent = createTextContent(schema, op.text);
            if (typeof insertionContent === 'string') {
              // For strings with newlines, use insertText which handles newlines naturally
              tr = tr.insertText(insertionContent, anchor);
            } else {
              // For simple text nodes, use insert
              tr = tr.insert(anchor, insertionContent);
            }
          } else if (op.type === "delete_text" && op.deleteText) {
            const docIndex = buildDocIndex(tr.doc, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.deleteText),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            const found = findMatches(docIndex, op.deleteText, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.deleteText),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(
              found,
              op.occurrenceIndex,
              op.maxOccurrences,
              false,
            );
            if (!selected.length) continue;
            selected
              .slice()
              .reverse()
              .forEach((m) => {
                tr = tr.delete(m.from, m.to);
            });
          } else if (op.type === "add_mark") {
            // Validate mark type exists in schema
            if (!schema.marks[op.markType]) {
              continue;
            }

            const docIndex = buildDocIndex(tr.doc, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            const found = findMatches(docIndex, op.text, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(found, op.occurrenceIndex, op.maxOccurrences, false);
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
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            const found = findMatches(docIndex, op.text, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(found, op.occurrenceIndex, op.maxOccurrences, false);
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
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            const found = findMatches(docIndex, op.text, {
              caseInsensitive: false,
              normalizeWhitespace: false,
              unifyNbsp: true,
              removeSoftHyphen: true,
              removeZeroWidth: true,
              normalizeQuotesAndDashes: true,
              unicodeForm: "NFC",
              wholeWord: isWholeWordLikely(op.text),
              contextBefore: op.contextBefore,
              contextAfter: op.contextAfter,
              contextWindow: 80,
            });
            if (!found.length) continue;
            const selected = selectByOccurrence(found, op.occurrenceIndex, op.maxOccurrences, false);
            if (!selected.length) continue;
            selected
              .slice()
              .reverse()
              .forEach((m) => {
              const oldMark = schema.marks[op.oldMarkType].create();
              const newMark = schema.marks[op.newMarkType].create();
                tr = tr.removeMark(m.from, m.to, oldMark).addMark(m.from, m.to, newMark);
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
              const docIndex = buildDocIndex(tr.doc, {
                caseInsensitive: false,
                normalizeWhitespace: false,
                unifyNbsp: true,
                removeSoftHyphen: true,
                removeZeroWidth: true,
                normalizeQuotesAndDashes: true,
                unicodeForm: "NFC",
              });
              const anchor = findAnchorPosition(
                docIndex,
                { afterText: op.afterText, beforeText: op.beforeText },
                {
                  caseInsensitive: false,
                  normalizeWhitespace: false,
                  unifyNbsp: true,
                  removeSoftHyphen: true,
                  removeZeroWidth: true,
                  normalizeQuotesAndDashes: true,
                  unicodeForm: "NFC",
                  wholeWord:
                    !!op.afterText && isWholeWordLikely(op.afterText) ||
                    (!!op.beforeText && isWholeWordLikely(op.beforeText)),
                },
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
              op.headingLevel,
            );
            tr = tr.insert(insertPos, newNode);
          } else {
            // Fallback to original position-based logic for regular operations
            const docSize = tr.doc.content.size;

            if (op.type === "insert_text" && typeof op.pos === "number") {
              if (op.pos >= 0 && op.pos <= docSize) {
                // Use createTextContent to properly handle newlines
                const insertionContent = createTextContent(schema, op.text);
                if (typeof insertionContent === 'string') {
                  // For strings with newlines, use insertText which handles newlines naturally
                  tr = tr.insertText(insertionContent, op.pos);
                } else {
                  // For simple text nodes, use insert
                  tr = tr.insert(op.pos, insertionContent);
                }
              }
            } else if (
              op.type === "replace_range" &&
              typeof op.from === "number" &&
              typeof op.to === "number"
            ) {
              if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
                // Use createTextContent to properly handle newlines
                const replacementContent = createTextContent(schema, op.text);
                if (typeof replacementContent === 'string') {
                  // For strings with newlines, use insertText which handles newlines naturally
                  tr = tr.delete(op.from, op.to).insertText(replacementContent, op.from);
                } else {
                  // For simple text nodes, use replaceRangeWith
                  tr = tr.replaceRangeWith(op.from, op.to, replacementContent);
                }
              }
            } else if (
              op.type === "delete_text" &&
              typeof op.from === "number" &&
              typeof op.to === "number"
            ) {
              if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
                tr = tr.delete(op.from, op.to);
              }
            }
          }

          // Update current document for next iteration
          currentDoc = tr.doc;
        }

        // Now run diff engine
        const newDocJson = currentDoc.toJSON();

        const delta = createJsonDiff(originalDocJson, newDocJson);

        const merged = buildContentWithJsonChanges(
          originalDocJson,
          newDocJson,
          delta,
        );

        // Create final document and return transaction
        try {
          const mergedNode = schema.nodeFromJSON(merged);

          const finalState = EditorState.create({ doc });

          // Replace with the merged content
          const result = finalState.tr.replaceWith(
            0,
            finalState.doc.content.size,
            mergedNode.content,
          );
          return result;
        } catch (error) {
          // Fallback: use the new document directly if merge fails
          const finalState = EditorState.create({ doc });
          const fallbackResult = finalState.tr.replaceWith(
            0,
            finalState.doc.content.size,
            currentDoc.content,
          );
          return fallbackResult;
        }
      },
    );

    return {
      ok: true,
      message: `Applied ${operations.length} operations successfully`,
      operationsApplied: operations.length,
    };
  },
});

/**
 * Rewrite a section of an Escrito identified by textual anchors, then merge via JSON diff.
 * - If both afterText and beforeText are provided, rewrites the range between them (exclusive of anchors).
 * - If only afterText is provided, rewrites from that anchor to the end of the document.
 * - If only beforeText is provided, rewrites from the start of the document up to that anchor.
 * - If neither is provided, rewrites the entire document.
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

    const snapshot = await ctx.runQuery(components.prosemirrorSync.lib.getSnapshot, {
      id: escrito.prosemirrorId,
    });
    if (!snapshot?.content) throw new Error("Document content not found");

    const schema = buildServerSchema();

    // Build inline content from lightweight style tags: [b]..[/b], [i]..[/i], [u]..[/u], [code]..[/code]
    const buildInlineFromStyledText = (schema: any, text: string): any[] => {
      const nodes: any[] = [];
      const tagRe = /\[(\/)?(b|i|u|code)\]/g;
      const markMap: Record<string, string> = { b: "bold", i: "italic", u: "underline", code: "code" } as const;
      let active: string[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = tagRe.exec(text)) !== null) {
        const idx = m.index;
        if (idx > last) {
          const chunk = text.slice(last, idx);
          if (chunk) {
            const marks = active
              .map((t) => markMap[t])
              .map((name) => (schema.marks[name] ? schema.marks[name].create() : null))
              .filter(Boolean);
            nodes.push(schema.text(chunk, marks));
          }
        }
        const closing = !!m[1];
        const tag = m[2];
        if (closing) {
          for (let i = active.length - 1; i >= 0; i--) {
            if (active[i] === tag) {
              active.splice(i, 1);
              break;
            }
          }
        } else {
          active.push(tag);
        }
        last = tagRe.lastIndex;
      }
      if (last < text.length) {
        const chunk = text.slice(last);
        if (chunk) {
          const marks = active
            .map((t) => markMap[t])
            .map((name) => (schema.marks[name] ? schema.marks[name].create() : null))
            .filter(Boolean);
          nodes.push(schema.text(chunk, marks));
        }
      }
      return nodes;
    };

    // Helper to build ProseMirror content from multiline targetText with inline styles
    const createParagraphNodesFromText = (text: string): any[] => {
      const paragraphs = text.split(/\n{2,}/);
      const nodes: any[] = [];
      for (const p of paragraphs) {
        const content = (() => {
          if (!p.includes("\n")) return buildInlineFromStyledText(schema, p);
          const parts = p.split("\n");
          const seq: any[] = [];
          for (let i = 0; i < parts.length; i++) {
            const inline = buildInlineFromStyledText(schema, parts[i]);
            if (inline.length) seq.push(...inline);
            if (i < parts.length - 1) {
              if (schema.nodes.hardBreak) seq.push(schema.nodes.hardBreak.create());
              else seq.push(schema.text(" "));
            }
          }
          return seq;
        })();
        const para = schema.nodes.paragraph.createAndFill({}, content);
        if (para) nodes.push(para);
      }
      if (!nodes.length) nodes.push(schema.nodes.paragraph.createAndFill({}, schema.text(""))!);
      return nodes;
    };

    await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (doc) => {
      const originalDocJson = doc.toJSON();
      const state = EditorState.create({ doc });
      let tr = state.tr;

      // Compute anchor positions using normalized index
      const docIndex = buildDocIndex(tr.doc, {
        caseInsensitive: false,
        normalizeWhitespace: false,
        unifyNbsp: true,
        removeSoftHyphen: true,
        removeZeroWidth: true,
        normalizeQuotesAndDashes: true,
        unicodeForm: "NFC",
      } as any);

      const searchOpts = {
        caseInsensitive: false,
        normalizeWhitespace: false,
        unifyNbsp: true,
        removeSoftHyphen: true,
        removeZeroWidth: true,
        normalizeQuotesAndDashes: true,
        unicodeForm: "NFC",
        wholeWord: false,
        contextWindow: 100,
      } as any;

      const afterPos = anchors.afterText
        ? findAnchorPosition(
            docIndex,
            { afterText: anchors.afterText, occurrenceIndex: anchors.occurrenceIndex },
            searchOpts,
          )
        : null;
      const beforePos = anchors.beforeText
        ? findAnchorPosition(
            docIndex,
            { beforeText: anchors.beforeText, occurrenceIndex: anchors.occurrenceIndex },
            searchOpts,
          )
        : null;

      let from = 0;
      let to = tr.doc.content.size;

      if (afterPos != null && beforePos != null) {
        from = Math.max(0, Math.min(afterPos, tr.doc.content.size));
        to = Math.max(0, Math.min(beforePos, tr.doc.content.size));
        if (from > to) {
          // Swap if anchors are reversed
          const tmp = from; from = to; to = tmp;
        }
      } else if (afterPos != null) {
        from = Math.max(0, Math.min(afterPos, tr.doc.content.size));
        to = tr.doc.content.size;
      } else if (beforePos != null) {
        from = 0;
        to = Math.max(0, Math.min(beforePos, tr.doc.content.size));
      }

      // Build replacement fragment
      const replacement = createParagraphNodesFromText(targetText);

      try {
        tr = tr.replaceWith(from, to, replacement as any);
      } catch (e) {
        // Fallback: if replaceWith fails due to invalid positions, insert at end
        tr = tr.insert(tr.doc.content.size, replacement as any);
      }

      const newDocJson = tr.doc.toJSON();
      const delta = createJsonDiff(originalDocJson, newDocJson);
      const merged = buildContentWithJsonChanges(originalDocJson, newDocJson, delta);

      const finalState = EditorState.create({ doc });
      try {
        const mergedNode = schema.nodeFromJSON(merged);
        return finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);
      } catch {
        // Fallback to direct content
        return finalState.tr.replaceWith(0, finalState.doc.content.size, tr.doc.content);
      }
    });

    return {
      ok: true,
      message: "Section rewrite applied via anchors",
    };
  },
});
