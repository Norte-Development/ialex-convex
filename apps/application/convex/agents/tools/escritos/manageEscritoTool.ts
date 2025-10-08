import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { 
  createEscritosListTemplate, 
  createEscritoCreateSuccessTemplate, 
  createInvalidActionTemplate 
} from "./templates";

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
    action: z.any().describe("Action to perform: 'create', or 'list'"),
    escritoId: z.any().optional().describe("Escrito ID for update operations"),
    templateId: z.any().optional().describe("Template ID. If provided with create, it will apply the template to the new escrito. If provided with apply_template, it will apply the template to the existing escrito."),
    title: z.any().optional().describe("Title for new escrito or metadata update"),
    status: z.any().optional().describe("Status for metadata update: 'borrador' or 'terminado'"),
  }).required({action: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      if (!caseId) {
        return createErrorResponse("No esta en un caso")
      }
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const action = args.action as string;

      switch (action) {
        case "create": {
          const caseIdError = validateStringParam(caseId, "caseId");
          if (caseIdError) return caseIdError;

          const titleError = validateStringParam(args.title, "title");
          if (titleError) return titleError;

          const targetCaseId: Id<"cases"> = caseId as Id<"cases">;
          const title: string = args.title.trim();

          return {
            action: "createEscrito",
            parameters: {
              title: title,
              caseId: targetCaseId,
              prosemirrorId: crypto.randomUUID(),
              templateId: args.templateId || undefined,
            },
            message: createEscritoCreateSuccessTemplate(title, targetCaseId)
          };
        }
        case "list": {
          const targetCaseId = caseId.trim();

          const escritos = await ctx.runQuery(internal.functions.documents.getEscritosForAgent, {
            caseId: targetCaseId as Id<"cases">,
          });

          return createEscritosListTemplate(targetCaseId, escritos);
        }

        default:
          return createErrorResponse(createInvalidActionTemplate(action));
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
