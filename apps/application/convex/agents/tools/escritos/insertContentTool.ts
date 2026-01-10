import { createTool, ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../../_generated/api";
import { getUserAndCaseIds, createErrorResponse, validateAndCorrectEscritoId } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Schema for insertContentTool placement descriptor.
 */
const placementSchema = z.union([
  z.object({
    type: z.literal("documentStart"),
  }),
  z.object({
    type: z.literal("documentEnd"),
  }),
  z.object({
    type: z.literal("range"),
    textStart: z.string().describe("Text marker for the start of the range"),
    textEnd: z.string().describe("Text marker for the end of the range"),
  }),
  z.object({
    type: z.literal("position"),
    position: z.number().describe("Absolute position to insert at"),
  }),
]);

/**
 * Schema for insertContentTool arguments.
 * All fields are required.
 */
const insertContentToolArgs = z.object({
  escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
  html: z.string().describe("HTML string to insert"),
  placement: placementSchema.describe("Placement descriptor specifying where to insert the content"),
});

type InsertContentToolArgs = z.infer<typeof insertContentToolArgs>;

export const insertContentTool = createTool({
  description: "Insert HTML content into an Escrito at documentStart, documentEnd, a text-defined range, or an absolute position.",
  args: insertContentToolArgs,
  handler: async function* (ctx: ToolCtx, args: InsertContentToolArgs) {
    const { caseId, userId } = getUserAndCaseIds(ctx.userId as string);

    yield {
      status: "Insertando contenido en el escrito",
      content: ""
    }

    await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
      userId: userId as Id<"users">,
      caseId: caseId as Id<"cases">,
      requiredLevel: "advanced"
    });

    // Validate escritoId is not empty
    if (!args.escritoId || args.escritoId.trim() === "") {
      return createErrorResponse("Se requiere un escritoId");
    }

    // Auto-correct truncated IDs
    const { id: correctedEscritoId, wasCorrected } = await validateAndCorrectEscritoId(
      ctx,
      args.escritoId.trim(),
      caseId
    );
    
    if (wasCorrected) {
      console.log(`✅ Auto-corrected escritoId in insertContent: ${args.escritoId} -> ${correctedEscritoId}`);
    }

    // Validate html is not empty
    if (!args.html || args.html.trim() === "") {
      return createErrorResponse("Se requiere contenido HTML");
    }

    const placement = args.placement;

    const result = await ctx.runAction(api.functions.escritosTransforms.index.insertHtmlContent, {
      escritoId: correctedEscritoId as any,
      html: args.html as string,
      placement,
    });

    return `# ✅ Contenido Insertado Exitosamente

## Resultado de la Operación
- **Estado**: Éxito
- **Mensaje**: ${result?.message ?? 'Contenido HTML insertado correctamente'}
- **Tipo de Ubicación**: ${placement.type}

## Detalles
El contenido HTML se ha insertado en el documento según la ubicación especificada.`;
  }
} as any);


