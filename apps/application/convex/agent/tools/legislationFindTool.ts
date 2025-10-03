import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Unified legislation finder tool.
 * Operations:
 * - search: Hybrid search in Qdrant with optional Mongo filters
 * - browse: Mongo-only filtered/paginated list (fast browse, no large fields)
 * - facets: Mongo facet counts for UI/filters
 * - metadata: Single document metadata (no large content fields)
 */
export const legislationFindTool = createTool({
  description:
    "Find legislation: hybrid search, browse by filters, fetch facets, or get metadata. Use operation to choose behavior.",
  args: z
    .object({
      operation: z
        .enum(["search", "browse", "facets", "metadata"]).describe(
          "Which operation to perform"
        ),
      // Common filters
      filters: z
        .object({
          type: z.string().optional(),
          jurisdiccion: z.string().optional(),
          estado: z
            .enum([
              "vigente",
              "derogada",
              "caduca",
              "anulada",
              "suspendida",
              "abrogada",
              "sin_registro_oficial",
            ])
            .optional(),
          sanction_date_from: z.string().optional(),
          sanction_date_to: z.string().optional(),
          publication_date_from: z.string().optional(),
          publication_date_to: z.string().optional(),
          number: z.number().optional(),
          search: z.string().optional(),
          vigencia_actual: z.boolean().optional(),
        })
        .optional(),
      // Pagination/sorting for browse
      limit: z.number().optional(),
      offset: z.number().optional(),
      sortBy: z.enum(["sanction_date", "updated_at", "created_at", "relevancia"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      // Search-specific
      query: z.string().optional(),
      // Metadata
      documentId: z.string().optional(),
    })
    .required({ operation: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const operation = args.operation as string;

      switch (operation) {
        case "search": {
          const queryError = validateStringParam(args.query, "query");
          if (queryError) return queryError;
          const query = args.query.trim();

        // Use hybrid Qdrant search
        const results = await ctx.runAction(
          internal.rag.qdrantUtils.legislation.searchNormatives,
          { query }
        );

        // Map to compact search response with snippet and relations count
        const resultsList = results.map((r, i: number) => ({
          rank: i + 1,
          score: r.score,
          id: r.id,
          documentId: r.document_id ?? null,
          title: r.title ?? null,
          tipoNorma: r.tipo_norma ?? null,
          jurisdiccion: r.jurisdiccion ?? null,
          publicationDate: r.publication_ts ? new Date(r.publication_ts * 1000).toISOString() : null,
          snippet: (r.text || "").slice(0, 500),
          relationsCount: Array.isArray(r.relaciones) ? r.relaciones.length : 0,
          url: r.url ?? null,
          content: r.text ?? null,
          // Citation metadata for agent
          citationId: r.document_id || r.id,
          citationType: 'leg',
          citationTitle: r.title || `${r.tipo_norma} ${r.number || ''}`.trim(),
        }));

        return `# 🔍 Resultados de Búsqueda Legislativa

## Consulta
**Término de búsqueda**: "${query}"

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}

## Resultados
${results.length === 0 ? 'No se encontraron resultados para la consulta.' : resultsList.map(r => `
### ${r.rank}. ${r.title || 'Sin título'}
- **ID del Documento**: ${r.documentId || 'N/A'}
- **Tipo de Norma**: ${r.tipoNorma || 'N/A'}
- **Jurisdicción**: ${r.jurisdiccion || 'N/A'}
- **Fecha de Publicación**: ${r.publicationDate ? new Date(r.publicationDate).toLocaleDateString() : 'N/A'}
- **Relaciones**: ${r.relationsCount}
- **Puntuación de Relevancia**: ${r.score.toFixed(3)}
- **Vista Previa**: ${r.snippet || 'Sin contenido disponible'}
${r.url ? `- **URL**: ${r.url}` : ''}
`).join('\n')}

---
*Búsqueda realizada en la base de datos legislativa.*`;
      }

      case "browse": {
        const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 100) : 20;
        const offset = typeof args.offset === "number" ? Math.max(0, args.offset) : 0;
        const sortBy = args.sortBy;
        const sortOrder = args.sortOrder ?? "desc";
        const filters = args.filters || {};

        const result = await ctx.runAction(api.functions.legislation.getNormatives, {
          filters,
          limit,
          offset,
          sortBy,
          sortOrder,
        });

        // Return only essential metadata fields for browse (no large content)
        const lightweightItems = result.items.map((item) => ({
          document_id: item.document_id,
          title: item.title,
          type: item.type,
          jurisdiccion: item.jurisdiccion,
          estado: item.estado,
          numero: item.numero,
          fuente: item.fuente,
          dates: item.dates,
          materia: item.materia,
          tags: item.tags,
          subestado: item.subestado,
          resumen: item.resumen,
          url: item.url,
          country_code: item.country_code,
        }));

        return `# 📋 Navegación de Legislación

## Filtros Aplicados
${Object.keys(filters).length > 0 ? Object.entries(filters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

## Paginación
- **Elementos por página**: ${limit}
- **Página actual**: ${Math.floor(offset / limit) + 1}
- **Total de elementos**: ${result.pagination.total}
- **Elementos mostrados**: ${lightweightItems.length}

## Resultados
${lightweightItems.length === 0 ? 'No se encontraron elementos que coincidan con los filtros.' : lightweightItems.map((item, index) => `
### ${offset + index + 1}. ${item.title || 'Sin título'}
- **ID del Documento**: ${item.document_id}
- **Tipo**: ${item.type || 'N/A'}
- **Jurisdicción**: ${item.jurisdiccion || 'N/A'}
- **Estado**: ${item.estado || 'N/A'}
- **Número**: ${item.numero || 'N/A'}
- **Fuente**: ${item.fuente || 'N/A'}
- **Materia**: ${item.materia || 'N/A'}
- **Resumen**: ${item.resumen || 'Sin resumen disponible'}
${item.url ? `- **URL**: ${item.url}` : ''}
`).join('\n')}

---
*Navegación realizada en la base de datos legislativa.*`;
      }

      case "facets": {
        const filters = args.filters || {};
        const facets = await ctx.runAction(api.functions.legislation.getNormativesFacets, { filters });
        return `# 📊 Facetas de Legislación

## Filtros Aplicados
${Object.keys(filters).length > 0 ? Object.entries(filters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

## Facetas Disponibles
${Object.keys(facets).length === 0 ? 'No hay facetas disponibles.' : Object.entries(facets).map(([facetName, facetData]) => `
### ${facetName}
${Array.isArray(facetData) ? facetData.map(item => `- **${item.value}**: ${item.count} elementos`).join('\n') : `- **Total**: ${facetData} elementos`}
`).join('\n')}

---
*Facetas generadas para la base de datos legislativa.*`;
      }

        case "metadata": {
          const documentIdError = validateStringParam(args.documentId, "documentId");
          if (documentIdError) return documentIdError;
          const documentId = args.documentId.trim();

        const normative = await ctx.runAction(api.functions.legislation.getNormativeById, {
          jurisdiction: args.filters?.jurisdiccion || "",
          id: documentId,
        });

        if (!normative) {
          return createErrorResponse(`Documento legislativo no encontrado con ID: ${documentId}`);
        }

        // Compute presence flags
        const hasContent = Boolean(normative.content || normative.texto || (Array.isArray(normative.articulos) && normative.articulos.length > 0));
        const relationsCount = Array.isArray(normative.relaciones) ? normative.relaciones.length : 0;

        // Return metadata without large fields
        const {
          content, texto, articulos, aprobacion, relaciones, created_at, updated_at, content_hash,
          ...rest
        } = normative;

        return `# 📄 Metadatos del Documento Legislativo

## Información del Documento
- **ID del Documento**: ${documentId}
- **Tiene Contenido**: ${hasContent ? 'Sí' : 'No'}
- **Número de Relaciones**: ${relationsCount}

## Metadatos
${Object.keys(rest).length === 0 ? 'No hay metadatos adicionales disponibles.' : Object.entries(rest).map(([key, value]) => `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}

---
*Metadatos obtenidos de la base de datos legislativa.*`;
      }

        default:
          return createErrorResponse(`Operación no soportada: ${operation}`);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);


