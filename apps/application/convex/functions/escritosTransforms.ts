import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { requireEscritoPermission } from "../auth_utils";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { createJsonDiff, buildContentWithJsonChanges } from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState } from "@tiptap/pm/state";
import { extractTextWithMapping, processEditWithMapping } from "../agent/escritosHelper";
import { api } from "../_generated/api";

export const applyEscritoOperations = mutation({
    args: {
      escritoId: v.id("escritos"),
      operations: v.array(v.object({
        type: v.union(v.literal("insert_text"), v.literal("replace_range"), v.literal("delete_text")),
        pos: v.optional(v.number()),
        from: v.optional(v.number()),
        to: v.optional(v.number()),
        text: v.string(),
      })),
    },
    handler: async (ctx, { escritoId, operations }) => {
      const escrito = await ctx.db.get(escritoId);
      if (!escrito) throw new Error("Escrito not found");
        

      console.log("operations", operations);

      const schema = buildServerSchema();
  
      await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (doc) => {
        // Store original for diff
        const originalDocJson = doc.toJSON();
        
        // Create a fresh state for applying operations
        let currentDoc = doc;
        
        // Apply operations one by one, creating new documents to avoid position drift
        for (const op of operations) {
          const state = EditorState.create({ doc: currentDoc });
          let tr = state.tr;
  
          // Ensure document has content for operations
          if (currentDoc.childCount === 0) {
            const paragraph = schema.nodes.paragraph.createAndFill()!;
            tr = tr.insert(0, paragraph);
          }
  
          // Validate and apply operation
          const docSize = tr.doc.content.size;
          
          if (op.type === "insert_text" && typeof op.pos === "number") {
            if (op.pos >= 0 && op.pos <= docSize) {
              tr = tr.insertText(op.text, op.pos);
            } else {
              console.warn(`Invalid insert position ${op.pos}, document size: ${docSize}`);
            }
            
          } else if (op.type === "replace_range" && typeof op.from === "number" && typeof op.to === "number") {
            if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
              tr = tr.replaceRangeWith(op.from, op.to, schema.text(op.text));
            } else {
              console.warn(`Invalid replace range ${op.from}-${op.to}, document size: ${docSize}`);
            }
            
          } else if (op.type === "delete_text" && typeof op.from === "number" && typeof op.to === "number") {
            if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
              tr = tr.delete(op.from, op.to);
            } else {
              console.warn(`Invalid delete range ${op.from}-${op.to}, document size: ${docSize}`);
            }
          }
  
          // Update current document for next iteration
          currentDoc = tr.doc;
        }
  
        // Now run diff engine
        const newDocJson = currentDoc.toJSON();
        console.log("newDocJson", newDocJson);
        const delta = createJsonDiff(originalDocJson, newDocJson);
        const merged = buildContentWithJsonChanges(originalDocJson, newDocJson, delta);
        
        console.log("Original:", JSON.stringify(originalDocJson, null, 2));
        console.log("New:", JSON.stringify(newDocJson, null, 2));
        console.log("Merged:", JSON.stringify(merged, null, 2));
  
        // Create final document and return transaction
        try {
          const mergedNode = schema.nodeFromJSON(merged);
          const finalState = EditorState.create({ doc });


          
          // Replace with the merged content
          return finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);
        } catch (error) {
          console.error("Error creating merged document:", error);
          console.error("Merged JSON:", JSON.stringify(merged, null, 2));
          
          // Fallback: use the new document directly if merge fails
          const finalState = EditorState.create({ doc });
          return finalState.tr.replaceWith(0, finalState.doc.content.size, currentDoc.content);
        }
      });
  
      return { ok: true };
    },
  });

/**
 * Apply text-based operations to an Escrito.
 * This mutation handles the conversion from text-based operations to position-based operations.
 */
export const applyTextBasedOperations = mutation({
  args: {
    escritoId: v.id("escritos"),
    edits: v.array(v.union(
      v.object({
        type: v.literal("replace"),
        findText: v.string(),
        replaceText: v.string(),
        contextBefore: v.optional(v.string()),
        contextAfter: v.optional(v.string()),
        replaceAll: v.optional(v.boolean()),
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
      })
    )),
  },
  handler: async (ctx, { escritoId, edits }) => {
    // Verify user has escrito write permission
    const escrito = await ctx.db.get(escritoId);
    if (!escrito) throw new Error("Escrito not found");

    console.log("Applying text-based operations:", edits);

    // Get the current document content
    const documentContent = await ctx.runQuery(api.prosemirror.getSnapshot, { id: escrito.prosemirrorId });
    if (!documentContent?.content) {
      throw new Error("Document content not found");
    }

    // Build schema for the transform function
    const schema = buildServerSchema();

    const operations: any[] = [];

    // Process each edit using the existing ProseMirror sync system
    for (const edit of edits) {
      console.log("Processing edit:", edit);
      
      if (edit.type === "replace") {
        // For now, create simple position-based operations
        // The actual text finding will be done within the transform function
        operations.push({
          type: "replace_range",
          from: 0, // Will be calculated in the transform
          to: 0,   // Will be calculated in the transform
          text: edit.replaceText,
          findText: edit.findText, // Pass the find text for processing
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
          replaceAll: edit.replaceAll,
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
          to: 0,   // Will be calculated in the transform
          text: "",
          deleteText: edit.deleteText, // Pass the delete text for processing
          contextBefore: edit.contextBefore,
          contextAfter: edit.contextAfter,
        });
      }
    }

    if (operations.length === 0) {
      return { message: "No changes to apply" };
    }

    console.log("Converted to position-based operations:", operations);

    // Apply the position-based operations using the existing mutation
  
    await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (doc) => {
      // Store original for diff
      const originalDocJson = doc.toJSON();
      
      // Create a fresh state for applying operations
      let currentDoc = doc;
      
      // Apply operations one by one
      for (const op of operations) {
        const state = EditorState.create({ doc: currentDoc });
        let tr = state.tr;

        // Ensure document has content for operations
        if (currentDoc.childCount === 0) {
          const paragraph = schema.nodes.paragraph.createAndFill()!;
          tr = tr.insert(0, paragraph);
        }

        // Handle text-based operations with position finding
        if (op.type === "replace_range" && op.findText) {
          // Find the text to replace in the current document
          const doc = tr.doc;
          const findText = op.findText;
          const matches: Array<{ start: number; end: number }> = [];
          
          // Traverse the document to find all occurrences
          doc.descendants((node, pos) => {
            if (node.isText) {
              const text = node.text || "";
              let index = 0;
              while (true) {
                const foundIndex = text.indexOf(findText, index);
                if (foundIndex === -1) break;
                
                const start = pos + foundIndex;
                const end = pos + foundIndex + findText.length;
                
                // Check context if provided
                let matchesContext = true;
                if (op.contextBefore || op.contextAfter) {
                  const beforeText = doc.textBetween(Math.max(0, start - 50), start);
                  const afterText = doc.textBetween(end, Math.min(doc.content.size, end + 50));
                  
                  if (op.contextBefore && !beforeText.includes(op.contextBefore)) {
                    matchesContext = false;
                  }
                  if (op.contextAfter && !afterText.includes(op.contextAfter)) {
                    matchesContext = false;
                  }
                }
                
                if (matchesContext) {
                  matches.push({ start, end });
                }
                
                index = foundIndex + 1;
              }
            }
          });
          
          if (matches.length === 0) {
            console.log(`Text "${findText}" not found in document`);
            continue;
          }
          
          // Apply replacements (reverse order to maintain position accuracy)
          const matchesToProcess = op.replaceAll ? matches : [matches[0]];
          matchesToProcess.reverse().forEach(match => {
            console.log(`Replacing text at positions ${match.start}-${match.end} with "${op.text}"`);
            tr = tr.replaceWith(match.start, match.end, schema.text(op.text));
          });
          
        } else if (op.type === "insert_text" && (op.afterText || op.beforeText)) {
          let insertPos = 0;
          
          if (op.afterText) {
            // Find position after the specified text
            const doc = tr.doc;
            let found = false;
            doc.descendants((node, pos) => {
              if (node.isText && !found) {
                const text = node.text || "";
                const index = text.indexOf(op.afterText);
                if (index !== -1) {
                  insertPos = pos + index + op.afterText.length;
                  found = true;
                }
              }
            });
            
            if (!found) {
              console.log(`Text "${op.afterText}" not found for insertion`);
              continue;
            }
          } else if (op.beforeText) {
            // Find position before the specified text
            const doc = tr.doc;
            let found = false;
            doc.descendants((node, pos) => {
              if (node.isText && !found) {
                const text = node.text || "";
                const index = text.indexOf(op.beforeText);
                if (index !== -1) {
                  insertPos = pos + index;
                  found = true;
                }
              }
            });
            
            if (!found) {
              console.log(`Text "${op.beforeText}" not found for insertion`);
              continue;
            }
          }
          
          console.log(`Inserting text "${op.text}" at position ${insertPos}`);
          tr = tr.insertText(op.text, insertPos);
          
        } else if (op.type === "delete_text" && op.deleteText) {
          // Find the text to delete in the current document
          const doc = tr.doc;
          const deleteText = op.deleteText;
          const matches: Array<{ start: number; end: number }> = [];
          
          // Traverse the document to find all occurrences
          doc.descendants((node, pos) => {
            if (node.isText) {
              const text = node.text || "";
              let index = 0;
              while (true) {
                const foundIndex = text.indexOf(deleteText, index);
                if (foundIndex === -1) break;
                
                const start = pos + foundIndex;
                const end = pos + foundIndex + deleteText.length;
                
                // Check context if provided
                let matchesContext = true;
                if (op.contextBefore || op.contextAfter) {
                  const beforeText = doc.textBetween(Math.max(0, start - 50), start);
                  const afterText = doc.textBetween(end, Math.min(doc.content.size, end + 50));
                  
                  if (op.contextBefore && !beforeText.includes(op.contextBefore)) {
                    matchesContext = false;
                  }
                  if (op.contextAfter && !afterText.includes(op.contextAfter)) {
                    matchesContext = false;
                  }
                }
                
                if (matchesContext) {
                  matches.push({ start, end });
                }
                
                index = foundIndex + 1;
              }
            }
          });
          
          if (matches.length === 0) {
            console.log(`Text "${deleteText}" not found in document`);
            continue;
          }
          
          // Apply deletions (reverse order to maintain position accuracy)
          matches.reverse().forEach(match => {
            console.log(`Deleting text at positions ${match.start}-${match.end}`);
            tr = tr.delete(match.start, match.end);
          });
          
        } else {
          // Fallback to original position-based logic for regular operations
          const docSize = tr.doc.content.size;
          
          if (op.type === "insert_text" && typeof op.pos === "number") {
            if (op.pos >= 0 && op.pos <= docSize) {
              tr = tr.insertText(op.text, op.pos);
            } else {
              console.warn(`Invalid insert position ${op.pos}, document size: ${docSize}`);
            }
            
          } else if (op.type === "replace_range" && typeof op.from === "number" && typeof op.to === "number") {
            if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
              tr = tr.replaceRangeWith(op.from, op.to, schema.text(op.text));
            } else {
              console.warn(`Invalid replace range ${op.from}-${op.to}, document size: ${docSize}`);
            }
            
          } else if (op.type === "delete_text" && typeof op.from === "number" && typeof op.to === "number") {
            if (op.from >= 0 && op.to <= docSize && op.from <= op.to) {
              tr = tr.delete(op.from, op.to);
            } else {
              console.warn(`Invalid delete range ${op.from}-${op.to}, document size: ${docSize}`);
            }
          }
        }

        // Update current document for next iteration
        currentDoc = tr.doc;
      }

      // Now run diff engine
      const newDocJson = currentDoc.toJSON();
      console.log("newDocJson", newDocJson);
      const delta = createJsonDiff(originalDocJson, newDocJson);
      const merged = buildContentWithJsonChanges(originalDocJson, newDocJson, delta);
      
      // Create final document and return transaction
      try {
        const mergedNode = schema.nodeFromJSON(merged);
        const finalState = EditorState.create({ doc });
        console.log("finalState", finalState);
        
        // Replace with the merged content
        return finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);
      } catch (error) {
        console.error("Error creating merged document:", error);
        
        // Fallback: use the new document directly if merge fails
        const finalState = EditorState.create({ doc });
        return finalState.tr.replaceWith(0, finalState.doc.content.size, currentDoc.content);
      }
    });

    return {
      ok: true,
      message: `Applied ${operations.length} operations successfully`,
      operationsApplied: operations.length,
    };
  },
});

