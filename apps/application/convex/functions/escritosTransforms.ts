import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { prosemirrorSync } from "../prosemirror";
import { requireEscritoPermission } from "../auth_utils";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";
import { createJsonDiff, buildContentWithJsonChanges } from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState } from "@tiptap/pm/state";

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

