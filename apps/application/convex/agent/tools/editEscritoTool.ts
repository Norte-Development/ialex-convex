import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../_generated/api";
import { z } from "zod";
import { validateEditType, validateMarkType, validateParagraphType, normalizeEditType } from "./validation";

/**
 * Tool for editing Escritos by text-based operations including text manipulation and mark formatting.
 * Uses applyTextBasedOperations mutation to apply changes.
 *
 * @description Edit an Escrito by finding and replacing text content, adding/removing formatting marks, and manipulating text. Much easier than position-based editing - just provide the text to find and what to replace it with, or specify mark operations.
 * @param {Object} args - Edit parameters
 * @param {string} args.escritoId - The Escrito ID (Convex doc id)
 * @param {Array} args.edits - Array of edit operations to apply
 * @returns {Promise<Object>} Result of the edit operations with validation information
 * @note Validation errors are logged to console but don't prevent valid edits from being applied. Any edit with a 'content' field is applied regardless of other validation issues. For addParagraph operations, defaults are applied before validation bypass occurs.
 *
 * @example
 * // Replace text with context
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "replace",
 *     findText: "old text",
 *     replaceText: "new text",
 *     contextBefore: "This is",
 *     contextAfter: "here"
 *   }]
 * });
 *
 * @example
 * // Target specific occurrence - change the 3rd occurrence only
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "replace",
 *     findText: "contract",
 *     replaceText: "agreement",
 *     occurrenceIndex: 3
 *   }]
 * });
 *
 * @example
 * // Limit number of changes - change first 2 occurrences only
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "replace",
 *     findText: "plaintiff",
 *     replaceText: "applicant",
 *     maxOccurrences: 2
 *   }]
 * });
 *
 * @example
 * // Delete 2nd occurrence of specific text
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "delete",
 *     deleteText: "redundant clause",
 *     occurrenceIndex: 2
 *   }]
 * });
 *
 * @example
 * // Add bold formatting to first 3 instances
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "add_mark",
 *     text: "important",
 *     markType: "bold",
 *     maxOccurrences: 3,
 *     contextAfter: "consideration"
 *   }]
 * });
 *
 * @example
 * // Add bold formatting to specific occurrence
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "add_mark",
 *     text: "important text", 
 *     markType: "bold",
 *     occurrenceIndex: 2
 *   }]
 * });
 *
 * // Change italic to bold
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "replace_mark",
 *     text: "emphasized text",
 *     oldMarkType: "italic",
 *     newMarkType: "bold"
 *   }]
 * });
 *
 * // Add new paragraph (with defaults: empty content and paragraph type)
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "add_paragraph",
 *     afterText: "end of section"
 *   }]
 * });
 *
 * // Add new paragraph with custom content
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "add_paragraph",
 *     content: "This is a new paragraph",
 *     paragraphType: "paragraph",
 *     afterText: "end of section"
 *   }]
 * });
 *
 * // Content field bypasses validation - this will be applied even with invalid paragraphType
 * await editEscritoTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   edits: [{
 *     type: "add_paragraph",
 *     content: "This will be applied regardless of validation errors",
 *     paragraphType: "invalid_type", // This would normally fail validation
 *     afterText: "end of section"
 *   }]
 * });
 */
export const editEscritoTool = createTool({
  description:
    "Edit an Escrito by finding and replacing text content, adding/removing formatting marks, manipulating paragraph structure, and transforming document elements. Much easier than position-based editing - just provide the text to find and what to replace it with, or specify mark/paragraph operations. Includes precise occurrence control: target specific occurrences (e.g., 'change the 3rd occurrence') or limit changes (e.g., 'change first 2 occurrences'). Validation errors are logged but don't prevent valid edits. Any edit with a 'content' field is applied regardless of validation issues.",
  args: z
    .object({
      escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
      edits: z.array(
        z.object({
          type: z.string().optional().describe("Edit operation type: replace, insert, delete, addMark, removeMark, replaceMark, addParagraph"),
          // Replace operation fields
          findText: z.string().optional().describe("Text to find and replace"),
          replaceText: z.string().optional().describe("Text to replace it with"),
          // Insert/Delete operation fields
          insertText: z.string().optional().describe("Text to insert"),
          deleteText: z.string().optional().describe("Text to delete"),
          // Common context fields
          contextBefore: z.string().optional().describe("Text that should appear before (for precise targeting)"),
          contextAfter: z.string().optional().describe("Text that should appear after (for precise targeting)"),
          // Mark operation fields
          text: z.string().optional().describe("Text to apply mark operation to"),
          markType: z.string().optional().describe("Mark type: bold, italic, code, strike, underline"),
          oldMarkType: z.string().optional().describe("Current mark type for replaceMark"),
          newMarkType: z.string().optional().describe("New mark type for replaceMark"),
          // Paragraph operation fields
          content: z.string().optional().describe("Content for new paragraph (defaults to empty string)"),
          paragraphType: z.string().optional().describe("Paragraph type: paragraph, heading, blockquote, bulletList, orderedList, codeBlock (defaults to 'paragraph')"),
          headingLevel: z.number().optional().describe("Heading level (1-6, required for heading type)"),
          afterText: z.string().optional().describe("Insert after this text"),
          beforeText: z.string().optional().describe("Insert before this text"),
          // Occurrence control options
          occurrenceIndex: z.number().optional().describe("Target specific occurrence (1-based): 'change the 3rd occurrence'"),
          maxOccurrences: z.number().optional().describe("Maximum number of occurrences to change: 'change first 2 occurrences'"),
          // Other options
          replaceAll: z.boolean().optional().describe("Replace all occurrences (for replace operations)")
        })
      ).min(1).describe("Array of edit operations to apply"),
    })
    .required({ escritoId: true, edits: true }),
  handler: async (
    ctx: ToolCtx,
    { escritoId, edits }: { escritoId: string; edits: any[] }
  ) => {
    if (!ctx.userId) {
      console.log("Not authenticated: proceeding with best-effort application");
    }

    // Validate inputs in handler for better error control
    if (!escritoId || typeof escritoId !== 'string') {
      console.log("Invalid escritoId: must be a non-empty string");
      return {
        ok: false,
        message: "Invalid escritoId: must be a non-empty string",
        validationErrors: ["EscritoId must be a non-empty string"],
        editsAttempted: edits.length,
        editsApplied: 0,
      };
    }

    if (!Array.isArray(edits) || edits.length === 0) {
      console.log("Invalid edits: must be a non-empty array");
      return {
        ok: false,
        message: "Invalid edits: must be a non-empty array",
        validationErrors: ["Edits must be a non-empty array"],
        editsAttempted: 0,
        editsApplied: 0,
      };
    }

    // Validate each edit operation - log errors but don't throw
    const validEdits = [];
    const validationErrors = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = { ...edits[i] };

      // Skip invalid edit objects
      if (!edit || typeof edit !== 'object') {
        console.log(`Skipping invalid edit at index ${i}: must be an object`);
        validationErrors.push(`Edit ${i}: Invalid edit object`);
        continue;
      }

      // Skip edits without valid type
      if (!edit.type || typeof edit.type !== 'string') {
        console.log(`Skipping edit at index ${i}: missing or invalid type`);
        validationErrors.push(`Edit ${i}: Missing or invalid type`);
        continue;
      }

      // Normalize edit type to match mutation contract
      const originalType = edit.type;
      edit.type = normalizeEditType(edit.type);

      if (!validateEditType(edit.type)) {
        console.log(`Skipping edit at index ${i}: unsupported type '${edit.type}'`);
        validationErrors.push(`Edit ${i}: Unsupported type '${edit.type}'`);
        continue;
      }

      // Validate mark-related operations
      if (edit.type === 'add_mark' || edit.type === 'remove_mark') {
        if (!edit.text || typeof edit.text !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid text property`);
          validationErrors.push(`Edit ${i}: Missing or invalid text property`);
          continue;
        }
        if (!edit.markType || typeof edit.markType !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid markType property`);
          validationErrors.push(`Edit ${i}: Missing or invalid markType property`);
          continue;
        }
        if (!validateMarkType(edit.markType)) {
          console.log(`Skipping edit at index ${i}: invalid markType '${edit.markType}'`);
          validationErrors.push(`Edit ${i}: Invalid markType '${edit.markType}'`);
          continue;
        }
      }

      // Validate replaceMark operation
      if (edit.type === 'replace_mark') {
        if (!edit.text || typeof edit.text !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid text property`);
          validationErrors.push(`Edit ${i}: Missing or invalid text property`);
          continue;
        }
        if (!edit.oldMarkType || typeof edit.oldMarkType !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid oldMarkType property`);
          validationErrors.push(`Edit ${i}: Missing or invalid oldMarkType property`);
          continue;
        }
        if (!edit.newMarkType || typeof edit.newMarkType !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid newMarkType property`);
          validationErrors.push(`Edit ${i}: Missing or invalid newMarkType property`);
          continue;
        }
        if (!validateMarkType(edit.oldMarkType)) {
          console.log(`Skipping edit at index ${i}: invalid oldMarkType '${edit.oldMarkType}'`);
          validationErrors.push(`Edit ${i}: Invalid oldMarkType '${edit.oldMarkType}'`);
          continue;
        }
        if (!validateMarkType(edit.newMarkType)) {
          console.log(`Skipping edit at index ${i}: invalid newMarkType '${edit.newMarkType}'`);
          validationErrors.push(`Edit ${i}: Invalid newMarkType '${edit.newMarkType}'`);
          continue;
        }
      }

      // Validate addParagraph operation
      if (edit.type === 'add_paragraph') {
        // Set defaults for addParagraph
        if (!edit.content) {
          edit.content = "";
        } else if (typeof edit.content !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: content must be a string`);
          validationErrors.push(`Edit ${i}: Content must be a string`);
          continue;
        }

        if (!edit.paragraphType) {
          edit.paragraphType = "paragraph";
        } else if (typeof edit.paragraphType !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: paragraphType must be a string`);
          validationErrors.push(`Edit ${i}: ParagraphType must be a string`);
          continue;
        }

        if (!validateParagraphType(edit.paragraphType)) {
          console.log(`Skipping edit at index ${i}: invalid paragraphType '${edit.paragraphType}'`);
          validationErrors.push(`Edit ${i}: Invalid paragraphType '${edit.paragraphType}'`);
          continue;
        }
        if (edit.paragraphType === 'heading' && (!edit.headingLevel || typeof edit.headingLevel !== 'number' || edit.headingLevel < 1 || edit.headingLevel > 6)) {
          console.log(`Skipping ${edit.type} at index ${i}: heading type requires headingLevel between 1 and 6`);
          validationErrors.push(`Edit ${i}: Heading type requires headingLevel between 1 and 6`);
          continue;
        }
      }

      // Validate occurrence control parameters
      if (edit.occurrenceIndex !== undefined) {
        if (typeof edit.occurrenceIndex !== 'number' || edit.occurrenceIndex < 1) {
          console.log(`Skipping edit at index ${i}: occurrenceIndex must be a positive number (1-based)`);
          validationErrors.push(`Edit ${i}: occurrenceIndex must be a positive number (1-based)`);
          continue;
        }
      }

      if (edit.maxOccurrences !== undefined) {
        if (typeof edit.maxOccurrences !== 'number' || edit.maxOccurrences < 1) {
          console.log(`Skipping edit at index ${i}: maxOccurrences must be a positive number`);
          validationErrors.push(`Edit ${i}: maxOccurrences must be a positive number`);
          continue;
        }
      }

      // Conflict detection warning
      if (edit.occurrenceIndex !== undefined && edit.maxOccurrences !== undefined) {
        console.log(`Warning: Edit ${i} has both occurrenceIndex and maxOccurrences specified. occurrenceIndex takes precedence.`);
      }

      // Content field bypass: Always include the edit if it has a content field, regardless of other validation
      // This happens AFTER defaults are set for addParagraph operations, so paragraphType will be set to "paragraph" if missing
      if (edit.content !== undefined) {
        console.log(`Including edit ${i} with content field (bypassing remaining validation after defaults applied)`);
        validEdits.push(edit);
        continue;
      }

      // Validate replace operation
      if (edit.type === 'replace') {
        if (!edit.findText || typeof edit.findText !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid findText property`);
          validationErrors.push(`Edit ${i}: Missing or invalid findText property`);
          continue;
        }
        if (!edit.replaceText || typeof edit.replaceText !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid replaceText property`);
          validationErrors.push(`Edit ${i}: Missing or invalid replaceText property`);
          continue;
        }
      }

      // Validate insert operation
      if (edit.type === 'insert') {
        if (!edit.insertText || typeof edit.insertText !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid insertText property`);
          validationErrors.push(`Edit ${i}: Missing or invalid insertText property`);
          continue;
        }
      }

      // Validate delete operation
      if (edit.type === 'delete') {
        if (!edit.deleteText || typeof edit.deleteText !== 'string') {
          console.log(`Skipping ${edit.type} at index ${i}: missing or invalid deleteText property`);
          validationErrors.push(`Edit ${i}: Missing or invalid deleteText property`);
          continue;
        }
      }

      // If we get here, the edit passed validation
      validEdits.push(edit);
    }

    // Check if we have any valid edits
    if (validEdits.length === 0) {
      console.log("No valid edits found, returning early");
      return {
        ok: false,
        message: "No valid edits to apply",
        validationErrors,
        editsAttempted: edits.length,
        editsApplied: 0,
      };
    }

    // Load Escrito
    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, {
      escritoId: escritoId as any,
    });
    if (!escrito) {
      console.log(`Escrito not found with ID: ${escritoId}`);
      return {
        ok: false,
        message: `Escrito not found with ID: ${escritoId}`,
        validationErrors: [`Escrito not found with ID: ${escritoId}`],
        editsAttempted: edits.length,
        editsApplied: 0,
      };
    }

    // Apply text-based operations directly using the new mutation
    const result = await ctx.runMutation(
      api.functions.escritosTransforms.applyTextBasedOperations,
      {
        escritoId: escritoId as any,
        edits: validEdits,
      }
    );

    // Return detailed response with validation information
    const message = validationErrors.length > 0
      ? `Applied ${validEdits.length}/${edits.length} edits successfully. ${validationErrors.length} edits were skipped due to validation errors.`
      : `Applied ${validEdits.length} edits successfully`;

    return {
      ok: true,
      message,
      editsApplied: validEdits.length,
      editsAttempted: edits.length,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      result,
    };
  },
} as any);

