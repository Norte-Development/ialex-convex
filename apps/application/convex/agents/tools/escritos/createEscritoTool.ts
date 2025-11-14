import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for creating Escritos with initial content.
 * 
 * This tool allows the agent to create a new escrito with initial content that can
 * then be modified using the editEscrito tool. The escrito is created with a ProseMirror
 * document containing the initial content.
 *
 * @description Create a new Escrito with initial content. The escrito will be created in the current case context with the provided title and initial content. After creation, you can modify it using the editEscrito tool.
 * @param {Object} args - Creation parameters
 * @param {string} args.title - The title for the new escrito
 * @param {string} args.initialContent - The initial text content for the escrito
 * @returns {Promise<string>} Success message with the escrito ID
 * @throws {Error} When not in case context, missing parameters, or creation fails
 *
 * @example
 * // Create a new escrito with initial content
 * await createEscritoTool.handler(ctx, {
 *   title: "Demanda por Daños y Perjuicios",
 *   initialContent: "Vengo a interponer demanda por daños y perjuicios..."
 * });
 */
export const createEscritoTool = createTool({
  description: "Create a new Escrito with initial content. The escrito will be created in the current case context with the provided title and initial content. After creation, you can modify it using the editEscrito tool.",
  args: z.object({
    title: z.string().describe("The title for the new escrito"),
    initialContent: z.string().describe("The initial text content for the escrito. It must be a valid HTML string."),
  }),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const { caseId, userId } = getUserAndCaseIds(ctx.userId as string);

      if (!caseId) {
        return createErrorResponse("No estás en un caso. Debes estar en un caso para crear un escrito.");
      }

      // Validate required parameters
      const titleError = validateStringParam(args.title, "title");
      if (titleError) return titleError;

      const contentError = validateStringParam(args.initialContent, "initialContent");
      if (contentError) return contentError;

      // Check case access
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "advanced",
      });

      const jsonContent = await ctx.runAction(internal.functions.html.parseHtmlToTiptapJson, {
        html: args.initialContent,
      });

      const parsedContent = JSON.parse(jsonContent);

      // Create the escrito with initial content
      const result = await ctx.runMutation(
        internal.functions.documents.createEscritoWithContent,
        {
          title: args.title.trim(),
          caseId: caseId as Id<"cases">,
          userId: userId as Id<"users">,
          initialContent: parsedContent,
        }
      );

      return `# ✅ Escrito Creado Exitosamente

## Detalles del Escrito
- **Título**: ${args.title}
- **ID**: ${result.escritoId}
- **Caso**: ${caseId}

El escrito ha sido creado con el contenido inicial proporcionado. Puedes modificarlo usando la herramienta \`editEscrito\` con el ID: \`${result.escritoId}\`

**Contenido inicial**:
${args.initialContent.substring(0, 200)}${args.initialContent.length > 200 ? "..." : ""}`;
    } catch (error) {
      return createErrorResponse(
        `Error al crear el escrito: ${error instanceof Error ? error.message : "Error desconocido"}`
      );
    }
  },
} as any);

