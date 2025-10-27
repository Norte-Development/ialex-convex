import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam } from "../shared/utils";


// Cache for jurisdiccion values
let jurisdiccionValuesCache: string[] | null = null;
let jurisdiccionCacheTime = 0;
const JURISDICCION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache for tribunal values
let tribunalValuesCache: string[] | null = null;
let tribunalCacheTime = 0;
const TRIBUNAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Helper function to convert ISO date string to Unix timestamp
const isoToTimestamp = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${isoDate}`);
  }
  return Math.floor(date.getTime() / 1000).toString();
};

/**
 * Unified fallos finder tool.
 * Operations:
 * - search: Hybrid search in Qdrant with optional filters
 * - browse: Mongo-only filtered/paginated list (fast browse, no large fields)
 * - facets: Mongo facet counts for UI/filters
 * - metadata: Single document metadata (no large content fields)
 */
export const searchFallosTool = createTool({
  description: async (ctx: ToolCtx) => {
    const now = Date.now();
    
    // Fetch jurisdiccion values with caching
    if (!jurisdiccionValuesCache || (now - jurisdiccionCacheTime) > JURISDICCION_CACHE_DURATION) {
      try {
        jurisdiccionValuesCache = await ctx.runAction(api.functions.fallos.getJurisdiccionValues, {});
        jurisdiccionCacheTime = now;
      } catch (error) {
        console.error('Failed to fetch jurisdiccion values for tool description:', error);
        jurisdiccionValuesCache = jurisdiccionValuesCache || []; // Use stale cache or empty array
      }
    }
    
    // Fetch tribunal values with caching
    if (!tribunalValuesCache || (now - tribunalCacheTime) > TRIBUNAL_CACHE_DURATION) {
      try {
        tribunalValuesCache = await ctx.runAction(api.functions.fallos.getTribunalValues, {});
        tribunalCacheTime = now;
      } catch (error) {
        console.error('Failed to fetch tribunal values for tool description:', error);
        tribunalValuesCache = tribunalValuesCache || []; // Use stale cache or empty array
      }
    }
    
    const jurisdiccionList = jurisdiccionValuesCache && jurisdiccionValuesCache.length > 0
      ? `Available jurisdiccion values: ${jurisdiccionValuesCache.join(', ')}`
      : '';
    
    const tribunalList = tribunalValuesCache && tribunalValuesCache.length > 0
      ? `Available tribunal values: ${tribunalValuesCache.join(', ')}`
      : '';
    
    return `Find fallos (jurisprudencia): hybrid search with filters, browse by filters, fetch facets, or get metadata. 

IMPORTANT: You can search by document_id alone without a query - just provide filters.document_id. Query is optional when filtering by document_id.

FILTERS:
- tribunal: Court name. ${tribunalList}
- materia: Subject matter
- promulgacion_from/to: Promulgation date range (ISO date strings, converted to timestamps)
- publicacion_from/to: Publication date range (ISO date strings, converted to timestamps)
- document_id: Document ID for exact match`;
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
          tribunal: z.string().optional(),
          materia: z.string().optional(),
          promulgacion_from: z.string().optional(),
          promulgacion_to: z.string().optional(),
          publicacion_from: z.string().optional(),
          publicacion_to: z.string().optional(),
          document_id: z.string().optional().describe("Document ID for exact match"),
        })
        .optional(),
      // Pagination/sorting for browse
      limit: z.number().optional(),
      offset: z.number().optional(),
      // Search-specific (optional when filtering by document_id)
      query: z.string().optional().describe("Search query text - optional when using document_id filter"),
      // Metadata
      documentId: z.string().optional(),
    })
    .required({ operation: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const operation = args.operation as string;

      switch (operation) {
        case "search": {
        // Build filters for Qdrant search
        const filters = args.filters || {};
        const qdrantFilters: any = {};
        
        // Direct field filters
        if (filters.tribunal) qdrantFilters.tribunal = filters.tribunal;
        if (filters.sala) qdrantFilters.sala = filters.sala;
        if (filters.document_id) qdrantFilters.document_id = filters.document_id;
        if (filters.materia) qdrantFilters.materia = filters.materia;

        
        // Date filters - convert ISO dates to timestamps
        try {
          if (filters.promulgacion_from) qdrantFilters.sanction_date_from = isoToTimestamp(filters.promulgacion_from);
          if (filters.promulgacion_to) qdrantFilters.sanction_date_to = isoToTimestamp(filters.promulgacion_to);
          if (filters.publicacion_from) qdrantFilters.publication_date_from = isoToTimestamp(filters.publicacion_from);
          if (filters.publicacion_to) qdrantFilters.publication_date_to = isoToTimestamp(filters.publicacion_to);
        } catch (dateError) {
          return createErrorResponse(`Error en formato de fecha: ${dateError instanceof Error ? dateError.message : 'Formato de fecha inválido'}`);
        }

        // Query is optional when filtering by document_id
        let query = "";
        if (args.query && typeof args.query === 'string') {
          query = args.query.trim();
        } else if (qdrantFilters.document_id) {
          // Use document_id as query when no query is provided
          query = qdrantFilters.document_id;
        } else {
          // Require query if no document_id filter is provided
          const queryError = validateStringParam(args.query, "query");
          if (queryError) return queryError;
          query = args.query.trim();
        }
        
        // Use hybrid Qdrant search with filters
        const results = await ctx.runAction(
          internal.rag.qdrantUtils.fallos.searchFallos,
          { 
            query,
            filters: Object.keys(qdrantFilters).length > 0 ? qdrantFilters : undefined
          }
        );

        // Map to compact search response
        const resultsList = results.map((r, i: number) => ({
          rank: i + 1,
          score: r.score,
          id: r.id,
          documentId: r.payload.document_id,
          titulo: r.payload.title,
          tribunal: r.payload.tribunal,
          jurisdiccion: r.payload.jurisdiccion,
          fecha: r.payload.date,
          promulgacion: r.payload.sanction_date,
          actor: r.payload.actor,
          demandado: r.payload.demandado,
          magistrados: r.payload.magistrados,
          materia: r.payload.materia,
          tags: r.payload.tags,
          sumario: r.payload.sumario,
          // Citation metadata for agent
          citationId: r.payload.document_id,
          citationType: 'jur',
          citationTitle: r.payload.title || `${r.payload.tribunal} - ${r.payload.actor} vs ${r.payload.demandado}`.trim(),
        }));

        return `# 🔍 Resultados de Búsqueda de Fallos

## Consulta
${args.query ? `**Término de búsqueda**: "${query}"` : `**Búsqueda por ID**: ${qdrantFilters.document_id || 'N/A'}`}
${Object.keys(qdrantFilters).length > 0 ? `\n## Filtros Aplicados\n${Object.entries(qdrantFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}` : ''}

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}

## Resultados
${results.length === 0 ? 'No se encontraron resultados para la consulta.' : resultsList.map(r => `
### ${r.rank}. ${r.titulo || 'Sin título'}
- **ID del Documento**: ${r.documentId || 'N/A'}
- **Tribunal**: ${r.tribunal || 'N/A'}
- **Jurisdicción**: ${r.jurisdiccion || 'N/A'}
- **Fecha**: ${r.fecha ? new Date(r.fecha).toLocaleDateString() : 'N/A'}
- **Promulgación**: ${r.promulgacion ? new Date(r.promulgacion).toLocaleDateString() : 'N/A'}
- **Actor**: ${r.actor || 'N/A'}
- **Demandado**: ${r.demandado || 'N/A'}
- **Magistrados**: ${r.magistrados || 'N/A'}
- **Materia**: ${r.materia || 'N/A'}
- **Tags**: ${r.tags.join(', ') || 'N/A'}
- **Puntuación de Relevancia**: ${r.score.toFixed(3)}
- **Sumario**: ${r.sumario || 'Sin sumario disponible'}
`).join('\n')}

---
*Búsqueda realizada en la base de datos de fallos.*`;
      }

      case "browse": {
        const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 100) : 20;
        const offset = typeof args.offset === "number" ? Math.max(0, args.offset) : 0;
        const sortBy = args.sortBy;
        const sortOrder = args.sortOrder ?? "desc";
        const filters = args.filters || {};

        const result = await ctx.runAction(api.functions.fallos.listFallos, {
          filters,
          limit,
          offset,
        });

        // Return only essential metadata fields for browse (no large content)
        const lightweightItems = result.items.map((item) => ({
          document_id: item.document_id,
          titulo: item.title,
          tribunal: item.tribunal,
          jurisdiccion: item.jurisdiccion,
          fecha: item.date,
          promulgacion: item.sanction_date,
          actor: item.actor,
          demandado: item.demandado,
          magistrados: item.magistrados,
          materia: item.materia,
          tags: item.tags,
          sumario: item.sumario,
          estado: item.estado,
        }));

        return `# 📋 Navegación de Fallos

## Filtros Aplicados
${Object.keys(filters).length > 0 ? Object.entries(filters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

## Paginación
- **Elementos por página**: ${limit}
- **Página actual**: ${Math.floor(offset / limit) + 1}
- **Total de elementos**: ${result.pagination.total}
- **Elementos mostrados**: ${lightweightItems.length}

## Resultados
${lightweightItems.length === 0 ? 'No se encontraron elementos que coincidan con los filtros.' : lightweightItems.map((item, index) => `
### ${offset + index + 1}. ${item.titulo || 'Sin título'}
- **ID del Documento**: ${item.document_id}
- **Tribunal**: ${item.tribunal || 'N/A'}
- **Jurisdicción**: ${item.jurisdiccion || 'N/A'}
- **Estado**: ${item.estado || 'N/A'}
- **Fecha**: ${item.fecha ? new Date(item.fecha).toLocaleDateString() : 'N/A'}
- **Promulgación**: ${item.promulgacion ? new Date(item.promulgacion).toLocaleDateString() : 'N/A'}
- **Actor**: ${item.actor || 'N/A'}
- **Demandado**: ${item.demandado || 'N/A'}
- **Magistrados**: ${item.magistrados || 'N/A'}
- **Materia**: ${item.materia || 'N/A'}
- **Tags**: ${item.tags.join(', ') || 'N/A'}
- **Sumario**: ${item.sumario || 'Sin sumario disponible'}
`).join('\n')}

---
*Navegación realizada en la base de datos de fallos.*`;
      }

      case "facets": {
        const filters = args.filters || {};
        const facets = await ctx.runAction(api.functions.fallos.getFallosFacets, { filters });
        return `# 📊 Facetas de Fallos

## Filtros Aplicados
${Object.keys(filters).length > 0 ? Object.entries(filters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

## Facetas Disponibles
${Object.keys(facets).length === 0 ? 'No hay facetas disponibles.' : Object.entries(facets).map(([facetName, facetData]) => `
### ${facetName}
${Array.isArray(facetData) ? facetData.map(item => `- **${item.value}**: ${item.count} elementos`).join('\n') : `- **Total**: ${facetData} elementos`}
`).join('\n')}

---
*Facetas generadas para la base de datos de fallos.*`;
      }

        case "metadata": {
          const documentIdError = validateStringParam(args.documentId, "documentId");
          if (documentIdError) return documentIdError;
          const documentId = args.documentId.trim();

        const fallo = await ctx.runAction(api.functions.fallos.getFallo, {
          documentId: documentId,
        });

        if (!fallo) {
          return createErrorResponse(`Fallo no encontrado con ID: ${documentId}`);
        }

        // Compute presence flags
        const hasContent = Boolean(fallo.content);
        const referenciasCount = Array.isArray(fallo.referencias_normativas) ? fallo.referencias_normativas.length : 0;
        const citasCount = Array.isArray(fallo.citas) ? fallo.citas.length : 0;

        // Return metadata without large fields
        const {
          content, created_at, updated_at,
          ...rest
        } = fallo;

        return `# 📄 Metadatos del Fallo

## Información del Documento
- **ID del Documento**: ${documentId}
- **Tiene Contenido**: ${hasContent ? 'Sí' : 'No'}
- **Número de Referencias Normativas**: ${referenciasCount}
- **Número de Citas**: ${citasCount}
- **Referencias Normativas**: ${fallo.referencias_normativas?.join(', ')}. Estas normas están referenciadas en este fallo.
- **Citas**: ${fallo.citas?.join(', ')}. Estas son las citas mencionadas en el fallo.

## Metadatos
${Object.keys(rest).length === 0 ? 'No hay metadatos adicionales disponibles.' : Object.entries(rest).map(([key, value]) => `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}

---
*Metadatos obtenidos de la base de datos de fallos.*`;
      }

        default:
          return createErrorResponse(`Operación no soportada: ${operation}`);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
