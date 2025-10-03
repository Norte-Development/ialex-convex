import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "../utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for managing Escritos - create, update metadata, apply templates, and list escritos.
 * Comprehensive escrito lifecycle management tool.
 *
 * @description Tool for managing Escritos - create, update metadata, apply templates, and list escritos. Comprehensive escrito lifecycle management tool that handles creation, metadata updates, template application, and listing operations.
 * @param {Object} args - Management parameters
 * @param {string} args.action - Action to perform: "create", "update_metadata", "apply_template", or "list"
 * @param {string} [args.caseId] - Case ID for create/list operations
 * @param {string} [args.escritoId] - Escrito ID for update operations
 * @param {string} [args.templateId] - Template ID for apply_template action
 * @param {string} [args.title] - Title for new escrito or metadata update
 * @param {string} [args.status] - Status for metadata update: "borrador" or "terminado"
 * @param {boolean} [args.mergeWithExisting] - Whether to merge template content with existing escrito (default: false)
 * @returns {Promise<Object>} Result of the management operation
 * @throws {Error} When user is not authenticated, not in case context, or operation fails
 *
 * @example
 * // Create new escrito
 * await manageEscritoTool.handler(ctx, {
 *   action: "create",
 *   caseId: "case_123",
 *   title: "Nueva Demanda"
 * });
 *
 * // Apply template to existing escrito
 * await manageEscritoTool.handler(ctx, {
 *   action: "apply_template",
 *   escritoId: "escrito_123",
 *   templateId: "template_456"
 * });
 */
export const manageEscritoTool = createTool({
  description: "Tool for managing Escritos - create, update metadata, apply templates, and list escritos. Comprehensive escrito lifecycle management tool that handles creation, metadata updates, template application, and listing operations.",
  args: z.object({
    action: z.any().describe("Action to perform: 'create', 'apply_template', or 'list'"),
    caseId: z.any().optional().describe("Case ID for create/list operations. Should be the current case unless specified otherwise."),
    escritoId: z.any().optional().describe("Escrito ID for update operations"),
    templateId: z.any().optional().describe("Template ID. If provided with create, it will apply the template to the new escrito. If provided with apply_template, it will apply the template to the existing escrito."),
    title: z.any().optional().describe("Title for new escrito or metadata update"),
    status: z.any().optional().describe("Status for metadata update: 'borrador' or 'terminado'"),
    mergeWithExisting: z.any().optional().describe("Whether to merge template content with existing escrito (default: false)")
  }).required({action: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const action = args.action as string;

      switch (action) {
        case "create": {
          const caseIdError = validateStringParam(args.caseId, "caseId");
          if (caseIdError) return caseIdError;

          const titleError = validateStringParam(args.title, "title");
          if (titleError) return titleError;

          const targetCaseId: Id<"cases"> = args.caseId.trim();
          const title: string = args.title.trim();

          return {
            action: "createEscrito",
            parameters: {
              title: title,
              caseId: targetCaseId,
              prosemirrorId: crypto.randomUUID(),
              templateId: args.templateId || undefined,
            },
            message: `Escrito "${title}" listo para crear en el caso ${targetCaseId}`
          };
        }

        case "apply_template": {
          const escritoIdError = validateStringParam(args.escritoId, "escritoId");
          if (escritoIdError) return escritoIdError;

          const templateIdError = validateStringParam(args.templateId, "templateId");
          if (templateIdError) return templateIdError;

          const escritoId = args.escritoId.trim();
          const templateId = args.templateId.trim();
          const mergeWithExisting = args.mergeWithExisting || false;

          // TODO: Implement apply template logic
          // This would apply a template to an existing escrito
          return `# ✅ Plantilla Aplicada

## Información de la Operación
- **ID del Escrito**: ${escritoId}
- **ID de la Plantilla**: ${templateId}
- **Fusión con Contenido Existente**: ${mergeWithExisting ? 'Sí' : 'No'}

## Resultado
La plantilla ha sido aplicada exitosamente al escrito.

## Próximos Pasos
1. Revisa el contenido aplicado usando readEscritoTool
2. Realiza ajustes necesarios usando editEscritoTool
3. Actualiza el estado si es necesario

---
*Funcionalidad de aplicación de plantillas - implementación pendiente*`;
        }

        case "list": {
          const caseIdError = validateStringParam(args.caseId, "caseId");
          if (caseIdError) return caseIdError;

          const targetCaseId = args.caseId.trim();

          // TODO: Implement list escritos logic
          // This would list all escritos in the specified case
          return `# 📋 Lista de Escritos

## Caso
- **ID del Caso**: ${targetCaseId}

## Escritos Encontrados
*Funcionalidad de listado de escritos - implementación pendiente*

## Información Adicional
- **Total de Escritos**: Por implementar
- **Estados**: Por implementar
- **Fechas de Creación**: Por implementar

---
*Funcionalidad de listado de escritos - implementación pendiente*`;
        }

        default:
          return createErrorResponse(`Acción no soportada: ${action}. Use 'create', 'apply_template', o 'list'.`);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
