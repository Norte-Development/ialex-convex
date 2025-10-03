import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for searching and retrieving template information.
 * Supports searching by name, category, content type, or getting specific templates.
 *
 * @description Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns comprehensive template details including content preview. Perfect for finding and previewing templates before applying them to escritos.
 * @param {Object} args - Search parameters
 * @param {string} [args.searchTerm] - Search term to filter templates by name or description
 * @param {string} [args.category] - Filter by category (e.g., "Derecho Civil", "Derecho Mercantil")
 * @param {string} [args.contentType] - Filter by content type: "html" or "json"
 * @param {string} [args.templateId] - Get specific template by ID
 * @param {number} [args.limit=20] - Maximum number of results to return (default: 20, max: 100)
 * @returns {Promise<Object>} Search results with template details and content preview
 * @throws {Error} When user is not authenticated or search fails
 *
 * @example
 * // Search templates by name
 * await searchTemplatesTool.handler(ctx, {
 *   searchTerm: "demanda",
 *   limit: 10
 * });
 *
 * // Get templates by category
 * await searchTemplatesTool.handler(ctx, {
 *   category: "Derecho Civil",
 *   contentType: "html"
 * });
 *
 * // Get specific template
 * await searchTemplatesTool.handler(ctx, {
 *   templateId: "template_123"
 * });
 */
export const searchTemplatesTool = createTool({
  description: "Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns comprehensive template details including content preview. Perfect for finding and previewing templates before applying them to escritos.",
  args: z.object({
    searchTerm: z.any().optional().describe("Search term to filter templates by name or description"),
    category: z.any().optional().describe("Filter by category (e.g., 'Derecho Civil', 'Derecho Mercantil')"),
    contentType: z.any().optional().describe("Filter by content type: 'html' or 'json'"),
    templateId: z.any().optional().describe("Get specific template by ID"),
    limit: z.any().optional().describe("Maximum number of results to return (default: 20, max: 100)")
  }).required({}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const searchTerm = args.searchTerm?.trim();
      const category = args.category?.trim();
      const contentType = args.contentType?.trim();
      const templateId = args.templateId?.trim();
      const limitError = validateNumberParam(args.limit, "limit", 1, 100, 20);
      if (limitError) return limitError;
      const limit = args.limit !== undefined ? args.limit : 20;

      // TODO: Implement template search logic
      // This would search for templates using the provided parameters
      
      if (templateId) {
        return `# 📄 Plantilla Específica

## Información de la Plantilla
- **ID de la Plantilla**: ${templateId}

## Detalles
*Funcionalidad de obtención de plantilla específica - implementación pendiente*

## Contenido
*Vista previa del contenido de la plantilla*

## Información Adicional
- **Categoría**: Por implementar
- **Tipo de Contenido**: Por implementar
- **Fecha de Creación**: Por implementar
- **Número de Usos**: Por implementar

## Próximos Pasos
1. Implementar obtención de plantilla por ID
2. Retornar contenido completo de la plantilla
3. Incluir metadatos de la plantilla
4. Mostrar vista previa del contenido

---
*Funcionalidad de plantilla específica - implementación pendiente*`;
      } else if (searchTerm) {
        return `# 🔍 Búsqueda de Plantillas

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados
*Funcionalidad de búsqueda de plantillas - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: Por implementar
- **Filtros Aplicados**: Término de búsqueda
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Próximos Pasos
1. Implementar búsqueda por nombre y descripción
2. Retornar lista de plantillas coincidentes
3. Incluir vista previa del contenido
4. Mostrar metadatos de cada plantilla

---
*Funcionalidad de búsqueda de plantillas - implementación pendiente*`;
      } else if (category || contentType) {
        return `# 📋 Plantillas Filtradas

## Filtros Aplicados
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Resultados
*Funcionalidad de filtrado de plantillas - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: Por implementar
- **Filtros Activos**: Categoría y/o tipo de contenido

## Próximos Pasos
1. Implementar filtrado por categoría
2. Implementar filtrado por tipo de contenido
3. Retornar plantillas que coincidan con los filtros
4. Incluir información relevante de cada plantilla

---
*Funcionalidad de filtrado de plantillas - implementación pendiente*`;
      } else {
        return `# 📋 Todas las Plantillas

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados
*Funcionalidad de listado general de plantillas - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Plantillas**: Por implementar
- **Plantillas Públicas**: Por implementar
- **Plantillas Privadas**: Por implementar

## Próximos Pasos
1. Implementar listado paginado de todas las plantillas
2. Incluir información básica de cada plantilla
3. Mostrar categorías y tipos de contenido
4. Permitir acceso a plantillas públicas y privadas del usuario

---
*Funcionalidad de listado general de plantillas - implementación pendiente*`;
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
