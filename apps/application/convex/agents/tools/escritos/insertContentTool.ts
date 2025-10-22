import { createTool, ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../../../_generated/api";
import { getUserAndCaseIds, validateStringParam, createErrorResponse } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

export const insertContentTool = createTool({
  description: "Insert HTML content into an Escrito at documentStart, documentEnd, a text-defined range, or an absolute position.",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
    html: z.any().describe("HTML string to insert"),
    placement: z.any().describe("Placement descriptor: {type:'documentStart'|'documentEnd'} | {type:'range', textStart, textEnd} | {type:'position', position}")
  }).required({escritoId: true, html: true, placement: true}),
  handler: async function* (ctx: ToolCtx, args: any) {
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

    const idErr = validateStringParam(args.escritoId, "escritoId");
    if (idErr) return idErr;
    const htmlErr = validateStringParam(args.html, "html");
    if (htmlErr) return htmlErr;
    if (!args.placement || typeof args.placement !== 'object') {
      return createErrorResponse("Objeto de ubicación inválido");
    }

    // Basic validation for placement variants
    const placement = args.placement as any;
    if (placement.type === 'range') {
      const sErr = validateStringParam(placement.textStart, "placement.textStart");
      if (sErr) return sErr;
      const eErr = validateStringParam(placement.textEnd, "placement.textEnd");
      if (eErr) return eErr;
    }
    if (placement.type === 'position') {
      if (typeof placement.position !== 'number' || !Number.isFinite(placement.position)) {
        return createErrorResponse("placement.position debe ser un número finito");
      }
    }

    const result = await ctx.runAction(api.functions.escritosTransforms.index.insertHtmlContent, {
      escritoId: args.escritoId as any,
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


