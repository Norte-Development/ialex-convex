import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../utils";
import { Id } from "../../../_generated/dataModel";
import { createContentSummary, generateTemplateSummary } from "../utils/sanitizeContent";

/**
 * Tool for searching and retrieving template information.
 * Supports searching by name, category, content type, or getting specific templates.
 *
 * @description Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns template summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding templates before applying them to escritos.
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
  description: "Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns template summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding templates before applying them to escritos.",
  args: z.object({
    searchTerm: z.string().optional().describe("Search term to filter templates by name or description"),
    category: z.string().optional().describe("Filter by category (e.g., 'Derecho Civil', 'Derecho Mercantil')"),
    contentType: z.string().optional().describe("Filter by content type: 'html' or 'json'"),
    templateId: z.string().optional().describe("Get specific template by ID"),
    limit: z.number().min(1).max(100).optional().describe("Maximum number of results to return (default: 20, max: 100)")
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
      
      if (templateId) {
        // Get specific template by ID
        const template = await ctx.runQuery(internal.functions.templates.internalGetModelo, {
          modeloId: templateId as Id<"modelos">,
          userId: userId as Id<"users">
        });
        
        if (!template) {
          return createErrorResponse(`Plantilla con ID "${templateId}" no encontrada`);
        }
        
        const contentPreview = template.content 
          ? (template.content.length > 200 
              ? template.content.substring(0, 200) + "..." 
              : template.content)
          : "Sin contenido";
        
        return `# 📄 Plantilla Específica

## Información de la Plantilla
- **ID de la Plantilla**: ${templateId}
- **Nombre**: ${template.name}
- **Categoría**: ${template.category}
- **Tipo de Contenido**: ${template.content_type || 'No especificado'}
- **Pública**: ${template.isPublic ? 'Sí' : 'No'}
- **Usos**: ${template.usageCount}
- **Fecha de Creación**: ${new Date(template._creationTime).toLocaleDateString('es-ES')}

## Descripción
${template.description || 'Sin descripción disponible'}

## Vista Previa del Contenido
\`\`\`${template.content_type || 'text'}
${contentPreview}
\`\`\`

## Tags
${template.tags && template.tags.length > 0 ? template.tags.map((tag: string) => `- ${tag}`).join('\n') : 'Sin tags'}

## Estado
- **Activa**: ${template.isActive ? 'Sí' : 'No'}
- **Creada por**: ${template.createdBy === 'system' ? 'Sistema' : 'Usuario'}

---
*Plantilla específica obtenida exitosamente*`;
      } else if (searchTerm) {
        // Search templates by search term
        const searchResult = await ctx.runQuery(internal.functions.templates.internalSearchModelos, {
          searchTerm,
          paginationOpts: { numItems: limit, cursor: null },
          category: category || undefined,
          content_type: contentType || undefined,
          userId: userId as Id<"users">
        });
        
        const templates = searchResult.page;
        
        if (templates.length === 0) {
          return `# 🔍 Búsqueda de Plantillas

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados
❌ **No se encontraron plantillas** que coincidan con el término de búsqueda.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: 0
- **Filtros Aplicados**: Término de búsqueda
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Sugerencias
1. Verifica la ortografía del término de búsqueda
2. Intenta con términos más generales
3. Usa filtros de categoría para refinar la búsqueda

---
*Búsqueda completada sin resultados*`;
        }
        
        const templatesList = templates.map((template: any, index: number) => {
          return `${index + 1}. ${generateTemplateSummary(template)}`;
        }).join('\n\n');
        
        return `# 🔍 Búsqueda de Plantillas

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: ${templates.length}
- **Más resultados disponibles**: ${searchResult.isDone ? 'No' : 'Sí'}
- **Filtros Aplicados**: Término de búsqueda
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Aplica filtros adicionales para refinar la búsqueda
3. Considera usar términos de búsqueda más específicos

---
*Búsqueda completada exitosamente*`;
      } else if (category || contentType) {
        // Filter templates by category and/or content type
        const filterResult = await ctx.runQuery(internal.functions.templates.internalGetModelos, {
          paginationOpts: { numItems: limit, cursor: null },
          category: category || undefined,
          content_type: contentType || undefined,
          userId: userId as Id<"users">
        });
        
        const templates = filterResult.page;
        
        if (templates.length === 0) {
          return `# 📋 Plantillas Filtradas

## Filtros Aplicados
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Resultados
❌ **No se encontraron plantillas** que coincidan con los filtros aplicados.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: 0
- **Filtros Activos**: Categoría y/o tipo de contenido

## Sugerencias
1. Verifica que la categoría sea correcta
2. Intenta con un tipo de contenido diferente
3. Usa un término de búsqueda para refinar los resultados

---
*Filtrado completado sin resultados*`;
        }
        
        const templatesList = templates.map((template: any, index: number) => {
          return `${index + 1}. ${generateTemplateSummary(template)}`;
        }).join('\n\n');
        
        return `# 📋 Plantillas Filtradas

## Filtros Aplicados
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: ${templates.length}
- **Más resultados disponibles**: ${filterResult.isDone ? 'No' : 'Sí'}
- **Filtros Activos**: Categoría y/o tipo de contenido

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Combina con términos de búsqueda para resultados más específicos
3. Explora otras categorías o tipos de contenido

---
*Filtrado completado exitosamente*`;
      } else {
        // Get all templates
        const allTemplatesResult = await ctx.runQuery(internal.functions.templates.internalGetModelos, {
          paginationOpts: { numItems: limit, cursor: null },
          userId: userId as Id<"users">
        });
        
        const templates = allTemplatesResult.page;
        
        if (templates.length === 0) {
          return `# 📋 Todas las Plantillas

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados
❌ **No hay plantillas disponibles** en el sistema.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Plantillas**: 0
- **Plantillas Públicas**: 0
- **Plantillas Privadas**: 0

## Sugerencias
1. Contacta al administrador para agregar plantillas al sistema
2. Crea tu primera plantilla personalizada
3. Verifica los permisos de acceso

---
*Listado general completado sin resultados*`;
        }
        
        const publicCount = templates.filter((t: any) => t.isPublic).length;
        const privateCount = templates.filter((t: any) => !t.isPublic).length;
        
        const templatesList = templates.map((template: any, index: number) => {
          return `${index + 1}. ${generateTemplateSummary(template)}`;
        }).join('\n\n');
        
        return `# 📋 Todas las Plantillas

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Plantillas**: ${templates.length}
- **Plantillas Públicas**: ${publicCount}
- **Plantillas Privadas**: ${privateCount}
- **Más resultados disponibles**: ${allTemplatesResult.isDone ? 'No' : 'Sí'}

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Aplica filtros por categoría o tipo de contenido
3. Usa términos de búsqueda para encontrar plantillas específicas

---
*Listado general completado exitosamente*`;
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
