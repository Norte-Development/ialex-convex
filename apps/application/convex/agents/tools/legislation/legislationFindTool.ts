import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam } from "../shared/utils";

// Cache for tipo_general values
let tipoGeneralValuesCache: string[] | null = null;
let tipoGeneralCacheTime = 0;
const TIPO_GENERAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache for jurisdiccion values
let jurisdiccionValuesCache: string[] | null = null;
let jurisdiccionCacheTime = 0;
const JURISDICCION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Unified legislation finder tool.
 * Operations:
 * - search: Hybrid search in Qdrant with optional Mongo filters
 * - browse: Mongo-only filtered/paginated list (fast browse, no large fields)
 * - facets: Mongo facet counts for UI/filters
 * - metadata: Single document metadata (no large content fields)
 */
export const legislationFindTool = createTool({
  description: async (ctx: ToolCtx) => {
    const now = Date.now();
    
    // Fetch tipo_general values with caching
    if (!tipoGeneralValuesCache || (now - tipoGeneralCacheTime) > TIPO_GENERAL_CACHE_DURATION) {
      try {
        tipoGeneralValuesCache = await ctx.runAction(api.functions.legislation.getTipoGeneralValues, {});
        tipoGeneralCacheTime = now;
      } catch (error) {
        console.error('Failed to fetch tipo_general values for tool description:', error);
        tipoGeneralValuesCache = tipoGeneralValuesCache || []; // Use stale cache or empty array
      }
    }
    
    // Fetch jurisdiccion values with caching
    if (!jurisdiccionValuesCache || (now - jurisdiccionCacheTime) > JURISDICCION_CACHE_DURATION) {
      try {
        jurisdiccionValuesCache = await ctx.runAction(api.functions.legislation.getJurisdiccionValues, {});
        jurisdiccionCacheTime = now;
      } catch (error) {
        console.error('Failed to fetch jurisdiccion values for tool description:', error);
        jurisdiccionValuesCache = jurisdiccionValuesCache || []; // Use stale cache or empty array
      }
    }
    
    const tipoGeneralList = tipoGeneralValuesCache && tipoGeneralValuesCache.length > 0
      ? `Available tipo_general values: ${tipoGeneralValuesCache.join(', ')}`
      : '';
    
    const jurisdiccionList = jurisdiccionValuesCache && jurisdiccionValuesCache.length > 0
      ? `Available jurisdiccion values: ${jurisdiccionValuesCache.join(', ')}`
      : '';
    
    return `Find legislation: hybrid search with filters, browse by filters, fetch facets, or get metadata. 

IMPORTANT: You can search by number alone without a query - just provide filters.number with the numeric part (e.g., 7302 for law 7302/2024). Query is optional when filtering by number.

FILTERS:
- tipo_general: Type of legislation. ${tipoGeneralList}
- jurisdiccion: Jurisdiction. ${jurisdiccionList}. Solo estas jurisdicciones son validas. Si hay dudas dejar en blanco. No se debe usar el pais como jurisdiccion. Las jurisdicciones son provincias o "nacional".
- estado: Status (vigente, derogada, caduca, anulada, suspendida, abrogada, sin_registro_oficial)
- number: Law number (use only numeric part)
- sanction_date_from/to: Sanction date range (ISO date strings)
- publication_date_from/to: Publication date range (ISO date strings)`;
  },
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
          tipo_general: z.string().optional(),
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
          number: z.union([z.number(), z.string()]).optional().describe("Law number (use only numeric part, e.g., 7302 for law 7302/2024)"),
          search: z.string().optional(),
          vigencia_actual: z.boolean().optional(),
        })
        .optional(),
      // Pagination/sorting for browse
      limit: z.number().optional(),
      offset: z.number().optional(),
      sortBy: z.enum(["sanction_date", "updated_at", "created_at", "relevancia"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      // Search-specific (optional when filtering by number)
      query: z.string().optional().describe("Search query text - optional when using number filter"),
      // Metadata
      documentId: z.string().optional(),
    })
    .required({ operation: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    try {

      console.log("args", args);

      const operation = args.operation as string;

      switch (operation) {
        case "search": {
        // Build filters for Qdrant search
        const filters = args.filters || {};
        const qdrantFilters: any = {};
        
        // Direct field filters
        if (filters.jurisdiccion){
          if (filters.jurisdiccion === "nacional" || filters.jurisdiccion === "Argentina") {
            qdrantFilters.jurisdiccion = "nac";
          } else {
            qdrantFilters.jurisdiccion = filters.jurisdiccion;
          }
        }
        if (filters.tipo_general) qdrantFilters.tipo_general = filters.tipo_general;
        if (filters.estado) qdrantFilters.estado = filters.estado;
        
        // Type filter (maps to tipo_norma which will be mapped to tipo_general in Qdrant)
        if (filters.type) qdrantFilters.tipo_norma = filters.type;
        
        // Number filter (will use OR logic in Qdrant for number and numero fields)
        if (filters.number) {
          // Extract numeric part if it's a string like "7302/2024"
          const numberStr = String(filters.number);
          const match = numberStr.match(/^\d+/);
          qdrantFilters.number = match ? match[0] : numberStr;
        }
        
        // Date filters (pass as date strings - Qdrant will convert to timestamps)
        if (filters.sanction_date_from) qdrantFilters.sanction_date_from = filters.sanction_date_from;
        if (filters.sanction_date_to) qdrantFilters.sanction_date_to = filters.sanction_date_to;
        if (filters.publication_date_from) qdrantFilters.publication_date_from = filters.publication_date_from;
        if (filters.publication_date_to) qdrantFilters.publication_date_to = filters.publication_date_to;

        // Query is optional when filtering by number
        let query = "";
        if (args.query && typeof args.query === 'string') {
          query = args.query.trim();
        } else if (qdrantFilters.number) {
          // Use number as query when no query is provided
          query = qdrantFilters.number;
        } else {
          // Require query if no number filter is provided
          const queryError = validateStringParam(args.query, "query");
          if (queryError) return queryError;
          query = args.query.trim();
        }
        
        // Use hybrid Qdrant search with filters
        const results = await ctx.runAction(
          internal.rag.qdrantUtils.legislation.searchNormatives,
          { 
            query,
            filters: Object.keys(qdrantFilters).length > 0 ? qdrantFilters : undefined
          }
        );

        // Map to compact search response with snippet and relations count
        const resultsList = results.map((r, i: number) => ({
          rank: i + 1,
          score: r.score,
          id: r.id,
          documentId: r.document_id ?? null,
          title: r.title ?? null,
          number: r.number ?? null,
          tipoGeneral: r.tipo_general ?? null,
          tipoDetalle: r.tipo_detalle ?? null,
          jurisdiccion: r.jurisdiccion ?? null,
          estado: r.estado ?? null,
          publicationDate: r.publication_ts ? new Date(r.publication_ts * 1000).toISOString() : null,
          sanctionDate: r.sanction_ts ? new Date(r.sanction_ts * 1000).toISOString() : null,
          snippet: (r.text || "").slice(0, 500),
          relationsCount: Array.isArray(r.relaciones) ? r.relaciones.length : 0,
          url: r.url ?? null,
          content: r.text ?? null,
          // Citation metadata for agent
          citationId: r.document_id || r.id,
          citationType: 'leg',
          citationTitle: r.title || `${r.tipo_general} ${r.number || ''}`.trim(),
        }));

        return `# 🔍 Resultados de Búsqueda Legislativa

## Consulta
${args.query ? `**Término de búsqueda**: "${query}"` : `**Búsqueda por número**: ${qdrantFilters.number || 'N/A'}`}
${Object.keys(qdrantFilters).length > 0 ? `\n## Filtros Aplicados\n${Object.entries(qdrantFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}` : ''}

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}

## Resultados
${results.length === 0 ? 'No se encontraron resultados para la consulta.' : resultsList.map(r => `
### ${r.rank}. ${r.title || 'Sin título'}
- **ID del Documento**: ${r.documentId || 'N/A'}
- **Número**: ${r.number || 'N/A'}
- **Tipo General**: ${r.tipoGeneral || 'N/A'}
- **Tipo Detalle**: ${r.tipoDetalle || 'N/A'}
- **Jurisdicción**: ${r.jurisdiccion || 'N/A'}
- **Estado**: ${r.estado || 'N/A'}
- **Fecha de Publicación**: ${r.publicationDate ? new Date(r.publicationDate).toLocaleDateString() : 'N/A'}
- **Fecha de Sanción**: ${r.sanctionDate ? new Date(r.sanctionDate).toLocaleDateString() : 'N/A'}
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
          resumen: item.resumen,
          url: item.url,  
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
- **Relaciones**: ${normative.relaciones?.map((r) => r.document_id).join(', ')}. Estas normas estan relacionadas a este documento. Puede usar los ids para leer directamente el contenido.

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


