import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { validateMarkType } from "../shared/validation";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateAndCorrectEscritoId } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { Infer } from "convex/values";
import { textBasedEditValidator } from "../../../functions/escritosTransforms/types";

/**
 * Tool for applying diffs to existing Escrito content.
 * Supports text replacement (including deletion) and formatting changes.
 * For inserting new content, use insertContentTool instead.
 *
 * @description Apply text replacements and formatting changes to an Escrito. Use this tool to:
 * - Replace existing text with new text
 * - Delete text by replacing with empty string
 * - Add formatting (bold, italic, etc.) to existing text
 * - Remove formatting from text
 * - Change formatting (e.g., italic to bold)
 *
 * Supports precise targeting with context before/after text, occurrence control,
 * and batch operations (multiple changes in one call).
 *
 * @example
 * // Replace text
 * await applyDiffsTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   diffs: [{
 *     type: "replace",
 *     findText: "plaintiff",
 *     replaceText: "applicant",
 *     maxOccurrences: 2
 *   }]
 * });
 *
 * @example
 * // Delete text
 * await applyDiffsTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   diffs: [{
 *     type: "replace",
 *     findText: "redundant clause",
 *     replaceText: "",
 *     contextBefore: "This is a",
 *     contextAfter: "that should be removed"
 *   }]
 * });
 *
 * @example
 * // Add formatting
 * await applyDiffsTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   diffs: [{
 *     type: "format",
 *     operation: "add",
 *     text: "important",
 *     markType: "bold",
 *     occurrenceIndex: 1
 *   }]
 * });
 *
 * @example
 * // Batch operations
 * await applyDiffsTool.handler(ctx, {
 *   escritoId: "escrito_123",
 *   diffs: [
 *     { type: "replace", findText: "old", replaceText: "new" },
 *     { type: "format", operation: "add", text: "key", markType: "bold" },
 *     { type: "replace", findText: "delete", replaceText: "" }
 *   ]
 * });
 */
/**
 * Schema for diff item operations.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const diffItemSchema = z.union([
  // Replace operation
  z.object({
    type: z.literal("replace"),
    findText: z
      .string()
      .describe(
        "EXACT text to find and replace. Must match EXACTLY (character-by-character, including ALL punctuation, spaces). CRITICAL: Do NOT include \\n (newlines) between paragraphs - paragraphs are separate nodes. Only include \\n for explicit line breaks WITHIN a paragraph. Be PRECISE - only the specific text requested."
      ),
    replaceText: z
      .string()
      .describe(
        'Text to replace findText with. Use empty string "" to delete. Must be provided (use "" for deletion).'
      ),
    contextBefore: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY before the target (within 80 characters distance). Must be text from the SAME or ADJACENT paragraph, NOT distant section titles. NO \\n characters. Empty string to omit."
      ),
    contextAfter: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY after the target (within 80 characters distance). Must be text from the SAME or NEXT paragraph, NOT distant titles. NO \\n characters. Empty string to omit."
      ),
    occurrenceIndex: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Target specific occurrence (1-based): 'change the 3rd occurrence'. 0 to omit."),
    maxOccurrences: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Maximum number of occurrences to change: 'change first 2 occurrences'. 0 to omit."),
    replaceAll: z
      .boolean()
      .default(false)
      .describe("Replace all occurrences (for replace operations). Default: false."),
  }),
  // Format operation - Add mark
  z.object({
    type: z.literal("format"),
    operation: z.literal("add"),
    text: z.string().describe("Text to apply formatting to"),
    markType: z
      .enum(["bold", "italic", "code", "strike", "underline"])
      .describe("Mark type to add"),
    contextBefore: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY before the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    contextAfter: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY after the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    occurrenceIndex: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Target specific occurrence (1-based). 0 to omit."),
    maxOccurrences: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Maximum number of occurrences to change. 0 to omit."),
  }),
  // Format operation - Remove mark
  z.object({
    type: z.literal("format"),
    operation: z.literal("remove"),
    text: z.string().describe("Text to remove formatting from"),
    markType: z
      .enum(["bold", "italic", "code", "strike", "underline"])
      .describe("Mark type to remove"),
    contextBefore: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY before the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    contextAfter: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY after the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    occurrenceIndex: z.number().int().min(0).default(0).describe("Target specific occurrence (1-based). 0 to omit."),
    maxOccurrences: z.number().int().min(0).default(0).describe("Maximum number of occurrences to change. 0 to omit."),
  }),
  // Format operation - Replace mark
  z.object({
    type: z.literal("format"),
    operation: z.literal("replace"),
    text: z.string().describe("Text to change formatting on"),
    oldMarkType: z
      .enum(["bold", "italic", "code", "strike", "underline"])
      .describe("Current mark type"),
    newMarkType: z
      .enum(["bold", "italic", "code", "strike", "underline"])
      .describe("New mark type"),
    contextBefore: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY before the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    contextAfter: z
      .string()
      .default("")
      .describe(
        "ACTUAL TEXT that appears IMMEDIATELY after the target (within 80 characters distance). NO \\n characters. Empty string to omit."
      ),
    occurrenceIndex: z.number().int().min(0).default(0).describe("Target specific occurrence (1-based). 0 to omit."),
    maxOccurrences: z.number().int().min(0).default(0).describe("Maximum number of occurrences to change. 0 to omit."),
  }),
]);

// Type for individual diff items from the tool's Zod schema
type DiffItem = z.infer<typeof diffItemSchema>;

// Type for edits that the mutation expects (different structure)
type MutationEdit = Infer<typeof textBasedEditValidator>;

// Preprocess diffs to handle stringified JSON and single objects
const diffsCoercedSchema = z.preprocess(
  (val) => {
    // Handle stringified JSON (including double-encoded)
    if (typeof val === "string") {
      try {
        let parsed: unknown = JSON.parse(val);
        // Handle double-encoding
        if (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
        // Return array if already an array, or wrap single object in array
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && typeof parsed === "object") {
          return [parsed];
        }
        // If parsing succeeded but result is invalid, return as-is to trigger validation error
        return val;
      } catch {
        // If parsing fails, return as-is to trigger validation error with clear message
        return val;
      }
    }
    // Handle single diff object (wrap in array)
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return [val];
    }
    // Already an array or other type - pass through
    return val;
  },
  z.array(diffItemSchema).min(1).describe("Array of diff operations to apply")
);

export const applyDiffsTool = createTool({
  description:
    "Apply text replacements and formatting changes to an Escrito. Use this tool to replace existing text, delete text (empty replacement), and modify formatting (bold, italic, etc.) on existing content. Supports precise targeting with contextBefore/contextAfter for accurate text location, occurrence control (e.g., 'change the 3rd occurrence'), and batch operations. For inserting new content or adding paragraphs, use insertContentTool instead.",
  args: z
    .object({
      escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
      diffs: diffsCoercedSchema,
    })
    .required({ escritoId: true, diffs: true }),
  handler: async (
    ctx: ToolCtx,
    { escritoId, diffs }: { escritoId: string; diffs: any[] }
  ) => {
    try {
      if (!ctx.userId) {
        console.log("Not authenticated: proceeding with best-effort application");
      }

      const { caseId, userId } = getUserAndCaseIds(ctx.userId as string);

      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "advanced",
      });

      // Validate escritoId
      const escritoIdError = validateStringParam(escritoId, "escritoId");
      if (escritoIdError) {
        return escritoIdError;
      }

      // Auto-correct truncated IDs
      const { id: correctedEscritoId, wasCorrected } = await validateAndCorrectEscritoId(
        ctx,
        escritoId.trim(),
        caseId
      );
      
      if (wasCorrected) {
        console.log(`✅ Auto-corrected escritoId in applyDiffs: ${escritoId} -> ${correctedEscritoId}`);
      }

      // Handle case where LLM passes diffs as a JSON string instead of an array
      let parsedDiffs = diffs;
      if (typeof diffs === "string") {
        console.log("⚠️  Diffs received as string, attempting to parse JSON...");
        try {
          // Try parsing once
          parsedDiffs = JSON.parse(diffs);

          // If result is still a string, it was double-encoded - parse again
          if (typeof parsedDiffs === "string") {
            console.log("⚠️  Detected double-encoding, parsing again...");
            parsedDiffs = JSON.parse(parsedDiffs);
          }

          if (!Array.isArray(parsedDiffs)) {
            console.error("❌ Parsed JSON is not an array");
            return createErrorResponse("Diffs deben ser un array");
          }

          console.log("✅ Successfully parsed diffs from JSON string");
          console.log(`📊 Parsed diffs count: ${parsedDiffs.length}`);
        } catch (parseError) {
          console.error("❌ Failed to parse diffs JSON string:", parseError);
          return createErrorResponse(
            `Formato inválido para diffs: no se pudo parsear el JSON. Error: ${parseError instanceof Error ? parseError.message : "Error desconocido"}`
          );
        }
      }

      // Validate diffs array
      if (!Array.isArray(parsedDiffs) || parsedDiffs.length === 0) {
        return createErrorResponse("Diffs debe ser un array no vacío");
      }

      // Helper function to validate context text
      function isValidContextText(context: string | undefined): { valid: boolean; reason?: string } {
        if (!context) return { valid: true }; // Optional field

        // Reject position markers
        if (/\[?Position:\s*\d+\]?/i.test(context)) {
          return {
            valid: false,
            reason:
              "contextBefore/contextAfter must contain ACTUAL TEXT, not position markers like '[Position: 289]'. Extract the actual text that appears before/after the target.",
          };
        }

        // Reject strings that are just numbers or position-like
        if (/^\s*\[?\s*\d+\s*\]?\s*$/.test(context)) {
          return {
            valid: false,
            reason:
              "contextBefore/contextAfter must contain actual text content, not just numbers or position indicators.",
          };
        }

        // Ensure it contains actual text (at least a few letters)
        if (!/[a-zA-Z]{3,}/.test(context)) {
          return {
            valid: false,
            reason:
              "contextBefore/contextAfter must contain actual text (letters), not just numbers, symbols, or position markers.",
          };
        }

        return { valid: true };
      }

      // Validate and convert diffs to mutation format
      const validEdits: MutationEdit[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < parsedDiffs.length; i++) {
        const diff = parsedDiffs[i];

        // Skip invalid diff objects
        if (!diff || typeof diff !== "object") {
          validationErrors.push(`Diff ${i + 1}: Invalid diff object`);
          continue;
        }

        // Validate diff type
        if (!diff.type || (diff.type !== "replace" && diff.type !== "format")) {
          validationErrors.push(`Diff ${i + 1}: Invalid type '${diff.type}'. Must be 'replace' or 'format'`);
          continue;
        }

        // Validate replace operation
        if (diff.type === "replace") {
          if (!diff.findText || typeof diff.findText !== "string") {
            validationErrors.push(`Diff ${i + 1}: Missing or invalid findText property`);
            continue;
          }
          if (diff.replaceText === undefined || typeof diff.replaceText !== "string") {
            validationErrors.push(`Diff ${i + 1}: Missing or invalid replaceText property`);
            continue;
          }

          // Validate context (empty string means "not provided")
          if (diff.contextBefore && diff.contextBefore !== "") {
            const contextBeforeCheck = isValidContextText(diff.contextBefore);
            if (!contextBeforeCheck.valid) {
              validationErrors.push(`Diff ${i + 1}: ${contextBeforeCheck.reason}`);
            }
          }
          if (diff.contextAfter && diff.contextAfter !== "") {
            const contextAfterCheck = isValidContextText(diff.contextAfter);
            if (!contextAfterCheck.valid) {
              validationErrors.push(`Diff ${i + 1}: ${contextAfterCheck.reason}`);
            }
          }

          // Validate occurrence control (0 means "not provided" due to defaults)
          const hasOccurrenceIndex = diff.occurrenceIndex !== undefined && diff.occurrenceIndex > 0;
          const hasMaxOccurrences = diff.maxOccurrences !== undefined && diff.maxOccurrences > 0;

          // Warn about conflicts
          if (hasOccurrenceIndex && hasMaxOccurrences) {
            console.log(
              `Warning: Diff ${i + 1} has both occurrenceIndex and maxOccurrences specified. occurrenceIndex takes precedence.`
            );
          }

          // Add to valid edits - construct with all fields to match MutationEdit type
          validEdits.push({
            type: "replace" as const,
            findText: diff.findText as string,
            replaceText: diff.replaceText as string,
            contextBefore: (diff.contextBefore && diff.contextBefore !== "") ? diff.contextBefore : undefined,
            contextAfter: (diff.contextAfter && diff.contextAfter !== "") ? diff.contextAfter : undefined,
            occurrenceIndex: hasOccurrenceIndex ? diff.occurrenceIndex : undefined,
            maxOccurrences: hasMaxOccurrences ? diff.maxOccurrences : undefined,
            replaceAll: diff.replaceAll === true ? true : undefined,
          });
        }

        // Validate format operation
        if (diff.type === "format") {
          if (!diff.operation || !["add", "remove", "replace"].includes(diff.operation)) {
            validationErrors.push(
              `Diff ${i + 1}: Missing or invalid operation. Must be 'add', 'remove', or 'replace'`
            );
            continue;
          }

          if (!diff.text || typeof diff.text !== "string") {
            validationErrors.push(`Diff ${i + 1}: Missing or invalid text property`);
            continue;
          }

          // Validate mark types
          if (diff.operation === "add" || diff.operation === "remove") {
            if (!diff.markType || typeof diff.markType !== "string") {
              validationErrors.push(`Diff ${i + 1}: Missing or invalid markType property`);
              continue;
            }
            if (!validateMarkType(diff.markType)) {
              validationErrors.push(`Diff ${i + 1}: Invalid markType '${diff.markType}'`);
              continue;
            }
          }

          if (diff.operation === "replace") {
            if (!diff.oldMarkType || typeof diff.oldMarkType !== "string") {
              validationErrors.push(`Diff ${i + 1}: Missing or invalid oldMarkType property`);
              continue;
            }
            if (!diff.newMarkType || typeof diff.newMarkType !== "string") {
              validationErrors.push(`Diff ${i + 1}: Missing or invalid newMarkType property`);
              continue;
            }
            if (!validateMarkType(diff.oldMarkType)) {
              validationErrors.push(`Diff ${i + 1}: Invalid oldMarkType '${diff.oldMarkType}'`);
              continue;
            }
            if (!validateMarkType(diff.newMarkType)) {
              validationErrors.push(`Diff ${i + 1}: Invalid newMarkType '${diff.newMarkType}'`);
              continue;
            }
          }

          // Validate context (empty string means "not provided")
          if (diff.contextBefore && diff.contextBefore !== "") {
            const contextBeforeCheck = isValidContextText(diff.contextBefore);
            if (!contextBeforeCheck.valid) {
              validationErrors.push(`Diff ${i + 1}: ${contextBeforeCheck.reason}`);
            }
          }
          if (diff.contextAfter && diff.contextAfter !== "") {
            const contextAfterCheck = isValidContextText(diff.contextAfter);
            if (!contextAfterCheck.valid) {
              validationErrors.push(`Diff ${i + 1}: ${contextAfterCheck.reason}`);
            }
          }

          // Validate occurrence control (0 means "not provided" due to defaults)
          const formatHasOccurrenceIndex = diff.occurrenceIndex !== undefined && diff.occurrenceIndex > 0;
          const formatHasMaxOccurrences = diff.maxOccurrences !== undefined && diff.maxOccurrences > 0;

          // Convert format operation to mutation format
          const contextBefore = (diff.contextBefore && diff.contextBefore !== "") ? diff.contextBefore : undefined;
          const contextAfter = (diff.contextAfter && diff.contextAfter !== "") ? diff.contextAfter : undefined;
          const occurrenceIndex = formatHasOccurrenceIndex ? diff.occurrenceIndex : undefined;
          const maxOccurrences = formatHasMaxOccurrences ? diff.maxOccurrences : undefined;

          if (diff.operation === "add") {
            validEdits.push({
              type: "add_mark" as const,
              text: diff.text as string,
              markType: diff.markType as "bold" | "italic" | "code" | "strike" | "underline",
              contextBefore,
              contextAfter,
              occurrenceIndex,
              maxOccurrences,
            });
          } else if (diff.operation === "remove") {
            validEdits.push({
              type: "remove_mark" as const,
              text: diff.text as string,
              markType: diff.markType as "bold" | "italic" | "code" | "strike" | "underline",
              contextBefore,
              contextAfter,
              occurrenceIndex,
              maxOccurrences,
            });
          } else {
            validEdits.push({
              type: "replace_mark" as const,
              text: diff.text as string,
              oldMarkType: diff.oldMarkType as "bold" | "italic" | "code" | "strike" | "underline",
              newMarkType: diff.newMarkType as "bold" | "italic" | "code" | "strike" | "underline",
              contextBefore,
              contextAfter,
              occurrenceIndex,
              maxOccurrences,
            });
          }
        }
      }

      // Check if we have any valid edits
      if (validEdits.length === 0) {
        return createErrorResponse("No se encontraron diffs válidos para aplicar");
      }

      // Load Escrito to verify it exists
      const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
        escritoId: correctedEscritoId as any,
      });
      if (!escrito) {
        return createErrorResponse(`Escrito no encontrado con ID: ${correctedEscritoId}`);
      }

      // Apply text-based operations using the mutation
      const result = await ctx.runMutation(api.functions.escritosTransforms.index.applyTextBasedOperations, {
        escritoId: correctedEscritoId as any,
        edits: validEdits,
      });

      // Return detailed response with validation information
      const message =
        validationErrors.length > 0
          ? `Se aplicaron ${validEdits.length}/${parsedDiffs.length} diffs exitosamente. ${validationErrors.length} diffs fueron omitidos debido a errores de validación.`
          : `Se aplicaron ${validEdits.length} diffs exitosamente`;

      return `# ✅ Diffs Aplicados Exitosamente

## Resultado de la Operación
- **Estado**: Éxito
- **Mensaje**: ${message}

## Estadísticas
- **Diffs Aplicados**: ${validEdits.length}
- **Diffs Intentados**: ${parsedDiffs.length}
- **Diffs Omitidos**: ${validationErrors.length}

${validationErrors.length > 0 ? `## Errores de Validación\n${validationErrors.map((error) => `- ${error}`).join("\n")}` : ""}

## Detalles
Los diffs se han aplicado al documento según las especificaciones proporcionadas.`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  },
} as any);

