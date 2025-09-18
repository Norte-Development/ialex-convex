import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState } from "@tiptap/pm/state";
import {
  extractTextWithMapping,
  processEditWithMapping,
} from "../agent/escritosHelper";
import { api } from "../_generated/api";

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
    const documentContent = await ctx.runQuery(api.prosemirror.getSnapshot, {
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

      // Split content by newlines and create text nodes with hard breaks
      const parts = content.split("\n");
      const nodes = [];

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          nodes.push(schema.text(parts[i]));
        }
        // Add hard break between text parts (except after the last part)
        if (i < parts.length - 1) {
          // Check if hardBreak node exists in schema
          if (schema.nodes.hardBreak) {
            nodes.push(schema.nodes.hardBreak.create());
          } else {
            // Fallback: create a space if hardBreak is not available
            nodes.push(schema.text(" "));
          }
        }
      }

      return nodes;
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

          // Handle text-based operations with position finding
          if (op.type === "replace_range" && op.findText) {
            // Find the text to replace in the current document
            const doc = tr.doc;
            const findText = op.findText;
            const matches: Array<{ start: number; end: number }> = [];

            // Traverse the document to find all occurrences with word boundaries
            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || "";
                const wordMatches = findAllTextWithWordBoundary(text, findText);

                for (const wordMatch of wordMatches) {
                  const start = pos + wordMatch.index;
                  const end = pos + wordMatch.index + wordMatch.length;

                  // Check context if provided
                  let matchesContext = true;
                  if (op.contextBefore || op.contextAfter) {
                    const beforeText = doc.textBetween(
                      Math.max(0, start - 50),
                      start,
                    );
                    const afterText = doc.textBetween(
                      end,
                      Math.min(doc.content.size, end + 50),
                    );

                    if (
                      op.contextBefore &&
                      !beforeText.includes(op.contextBefore)
                    ) {
                      matchesContext = false;
                    }
                    if (
                      op.contextAfter &&
                      !afterText.includes(op.contextAfter)
                    ) {
                      matchesContext = false;
                    }
                  }

                  if (matchesContext) {
                    matches.push({ start, end });
                  }
                }
              }
            });

            if (matches.length === 0) {
              continue;
            }

            // Apply occurrence selection logic
            const matchesToProcess = selectMatchesByOccurrence(
              matches,
              op.occurrenceIndex,
              op.maxOccurrences,
              op.replaceAll,
            );

            if (matchesToProcess.length === 0) {
              continue;
            }

            // Apply replacements (reverse order to maintain position accuracy)
            matchesToProcess.reverse().forEach((match) => {
              tr = tr.replaceWith(match.start, match.end, schema.text(op.text));
            });
          } else if (
            op.type === "insert_text" &&
            (op.afterText || op.beforeText)
          ) {
            let insertPos = 0;

            if (op.afterText) {
              // Find position after the specified text
              const doc = tr.doc;
              let found = false;
              doc.descendants((node, pos) => {
                if (node.isText && !found) {
                  const text = node.text || "";
                  const wordMatches = findAllTextWithWordBoundary(
                    text,
                    op.afterText,
                  );
                  if (wordMatches.length > 0) {
                    const firstMatch = wordMatches[0];
                    insertPos = pos + firstMatch.index + firstMatch.length;
                    found = true;
                  }
                }
              });

              if (!found) {
                continue;
              }
            } else if (op.beforeText) {
              // Find position before the specified text
              const doc = tr.doc;
              let found = false;
              doc.descendants((node, pos) => {
                if (node.isText && !found) {
                  const text = node.text || "";
                  const wordMatches = findAllTextWithWordBoundary(
                    text,
                    op.beforeText,
                  );
                  if (wordMatches.length > 0) {
                    const firstMatch = wordMatches[0];
                    insertPos = pos + firstMatch.index;
                    found = true;
                  }
                }
              });

              if (!found) {
                continue;
              }
            }

            tr = tr.insertText(op.text, insertPos);
          } else if (op.type === "delete_text" && op.deleteText) {
            // Find the text to delete in the current document
            const doc = tr.doc;
            const deleteText = op.deleteText;
            const matches: Array<{ start: number; end: number }> = [];

            // Traverse the document to find all occurrences with word boundaries
            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || "";
                const wordMatches = findAllTextWithWordBoundary(
                  text,
                  deleteText,
                );

                for (const wordMatch of wordMatches) {
                  const start = pos + wordMatch.index;
                  const end = pos + wordMatch.index + wordMatch.length;

                  // Check context if provided
                  let matchesContext = true;
                  if (op.contextBefore || op.contextAfter) {
                    const beforeText = doc.textBetween(
                      Math.max(0, start - 50),
                      start,
                    );
                    const afterText = doc.textBetween(
                      end,
                      Math.min(doc.content.size, end + 50),
                    );

                    if (
                      op.contextBefore &&
                      !beforeText.includes(op.contextBefore)
                    ) {
                      matchesContext = false;
                    }
                    if (
                      op.contextAfter &&
                      !afterText.includes(op.contextAfter)
                    ) {
                      matchesContext = false;
                    }
                  }

                  if (matchesContext) {
                    matches.push({ start, end });
                  }
                }
              }
            });

            if (matches.length === 0) {
              continue;
            }

            // Apply occurrence selection logic
            const matchesToProcess = selectMatchesByOccurrence(
              matches,
              op.occurrenceIndex,
              op.maxOccurrences,
              false, // delete doesn't have replaceAll option
            );

            if (matchesToProcess.length === 0) {
              continue;
            }

            // Apply deletions (reverse order to maintain position accuracy)
            matchesToProcess.reverse().forEach((match) => {
              tr = tr.delete(match.start, match.end);
            });
          } else if (op.type === "add_mark") {
            // Validate mark type exists in schema
            if (!schema.marks[op.markType]) {
              continue;
            }

            // Add mark to text that doesn't already have it
            const matches = findTextWithoutMark(tr.doc, op.text, op.markType);

            // Apply context filtering if provided
            const filteredMatches = matches.filter((match) => {
              if (op.contextBefore || op.contextAfter) {
                const beforeText = tr.doc.textBetween(
                  Math.max(0, match.start - 50),
                  match.start,
                );
                const afterText = tr.doc.textBetween(
                  match.end,
                  Math.min(tr.doc.content.size, match.end + 50),
                );

                if (
                  op.contextBefore &&
                  !beforeText.includes(op.contextBefore)
                ) {
                  return false;
                }
                if (op.contextAfter && !afterText.includes(op.contextAfter)) {
                  return false;
                }
              }
              return true;
            });

            if (filteredMatches.length === 0) {
              continue;
            }

            // Apply occurrence selection logic
            const matchesToProcess = selectMatchesByOccurrence(
              filteredMatches,
              op.occurrenceIndex,
              op.maxOccurrences,
              false, // marks don't use replaceAll
            );

            if (matchesToProcess.length === 0) {
              continue;
            }

            // Apply marks (reverse order to maintain position accuracy)
            matchesToProcess.reverse().forEach((match) => {
              const mark = schema.marks[op.markType].create();
              tr = tr.addMark(match.start, match.end, mark);
            });
          } else if (op.type === "remove_mark") {
            // Validate mark type exists in schema
            if (!schema.marks[op.markType]) {
              continue;
            }

            // Remove mark from text that has it
            const matches = findTextWithMark(tr.doc, op.text, op.markType);

            // Apply context filtering if provided
            const filteredMatches = matches.filter((match) => {
              if (op.contextBefore || op.contextAfter) {
                const beforeText = tr.doc.textBetween(
                  Math.max(0, match.start - 50),
                  match.start,
                );
                const afterText = tr.doc.textBetween(
                  match.end,
                  Math.min(tr.doc.content.size, match.end + 50),
                );

                if (
                  op.contextBefore &&
                  !beforeText.includes(op.contextBefore)
                ) {
                  return false;
                }
                if (op.contextAfter && !afterText.includes(op.contextAfter)) {
                  return false;
                }
              }
              return true;
            });

            if (filteredMatches.length === 0) {
              continue;
            }

            // Apply occurrence selection logic
            const matchesToProcess = selectMatchesByOccurrence(
              filteredMatches,
              op.occurrenceIndex,
              op.maxOccurrences,
              false, // marks don't use replaceAll
            );

            if (matchesToProcess.length === 0) {
              continue;
            }

            // Remove marks (reverse order to maintain position accuracy)
            matchesToProcess.reverse().forEach((match) => {
              const mark = schema.marks[op.markType].create();
              tr = tr.removeMark(match.start, match.end, mark);
            });
          } else if (op.type === "replace_mark") {
            // Validate mark types exist in schema
            if (!schema.marks[op.oldMarkType]) {
              continue;
            }
            if (!schema.marks[op.newMarkType]) {
              continue;
            }

            // Replace one mark type with another
            const matches = findTextWithMark(tr.doc, op.text, op.oldMarkType);

            // Apply context filtering if provided
            const filteredMatches = matches.filter((match) => {
              if (op.contextBefore || op.contextAfter) {
                const beforeText = tr.doc.textBetween(
                  Math.max(0, match.start - 50),
                  match.start,
                );
                const afterText = tr.doc.textBetween(
                  match.end,
                  Math.min(tr.doc.content.size, match.end + 50),
                );

                if (
                  op.contextBefore &&
                  !beforeText.includes(op.contextBefore)
                ) {
                  return false;
                }
                if (op.contextAfter && !afterText.includes(op.contextAfter)) {
                  return false;
                }
              }
              return true;
            });

            if (filteredMatches.length === 0) {
              continue;
            }

            // Apply occurrence selection logic
            const matchesToProcess = selectMatchesByOccurrence(
              filteredMatches,
              op.occurrenceIndex,
              op.maxOccurrences,
              false, // marks don't use replaceAll
            );

            if (matchesToProcess.length === 0) {
              continue;
            }

            // Replace marks (reverse order to maintain position accuracy)
            matchesToProcess.reverse().forEach((match) => {
              const oldMark = schema.marks[op.oldMarkType].create();
              const newMark = schema.marks[op.newMarkType].create();
              tr = tr
                .removeMark(match.start, match.end, oldMark)
                .addMark(match.start, match.end, newMark);
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

            // Find insertion position
            const insertPos = findInsertPosition(
              tr.doc,
              op.afterText,
              op.beforeText,
            );

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
                tr = tr.insertText(op.text, op.pos);
              }
            } else if (
              op.type === "replace_range" &&
              typeof op.from === "number" &&
              typeof op.to === "number"
            ) {
              if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
                tr = tr.replaceRangeWith(op.from, op.to, schema.text(op.text));
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
