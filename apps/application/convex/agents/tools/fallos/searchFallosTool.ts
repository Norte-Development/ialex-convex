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

/**
 * Normalizes jurisdiction values to the correct format.
 * Matches legislation behavior: maps common "nacional"/"Argentina" variants -> "nac",
 * and omits the filter if empty/whitespace.
 */
function normalizeJurisdiccion(jurisdiccion: string | undefined | null): string | undefined {
  if (!jurisdiccion) return undefined;

  const normalized = jurisdiccion.trim().toLowerCase();
  if (normalized === "") return undefined;

  const nacionalVariations = [
    "nacional",
    "nación",
    "nacion",
    "argentina",
    "argentino",
    "federal",
    "nación argentina",
    "nacion argentina",
    "república argentina",
    "republica argentina",
    "república",
    "republica",
  ];

  if (nacionalVariations.includes(normalized)) {
    return "nac";
  }

  return normalized;
}

// Helper function to convert ISO date string to Unix timestamp
const isoToTimestamp = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${isoDate}`);
  }
  return Math.floor(date.getTime() / 1000).toString();
};

/**
 * Treats "default" date range values (often auto-filled by UI/LLM) as NO-OP.
 * These broad ranges can unintentionally exclude documents missing date fields
 * because Qdrant uses MUST range filters.
 */
function isNoOpDateFilterValue(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  if (v === "") return true;
  // Common "wide open" defaults:
  if (v === "1900-01-01" || v === "2100-01-01") return true;
  // Same defaults after timestamp conversion:
  if (v === "-2208988800" || v === "4102444800") return true;
  return false;
}

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
    
    return `Find fallos (jurisprudencia): hybrid search with optional filters, browse by filters, fetch facets, or get metadata. 

IMPORTANT: You can search by document_id alone without a query - just provide filters.document_id. Query is optional when filtering by document_id.

IMPORTANT (DATES): Avoid date filters unless the user explicitly specifies dates. If you MUST use date filters, set dateFiltersExplicit=true.
IMPORTANT (STRICT FILTERS): Avoid strict filters unless the user explicitly asks (e.g. tribunal/materia). If you MUST use strict filters, set strictFilters=true.

FILTERS:
- tribunal (STRICT): Court name. ${tribunalList}
- jurisdiccion: Jurisdiction. ${jurisdiccionList}. CRITICAL: If no jurisdiction is mentioned, LEAVE THIS FILTER EMPTY (do not include it). Common variants like "Nacional", "Argentina" will be normalized to "nac".
- materia (STRICT): Subject matter
- promulgacion_from/to (DATES): Promulgation date range (ISO date strings, converted to timestamps)
- publicacion_from/to (DATES): Publication date range (ISO date strings, converted to timestamps)
- document_id: Document ID for exact match`;
  },
  args: z
    .object({
      operation: z
        .enum(["search", "browse", "facets", "metadata"]).describe(
          "Which operation to perform"
        ),
      // Controls to reduce over-filtering by the model
      strictFilters: z.boolean().optional().describe("Only set true when the user explicitly requested strict filters (tribunal/materia)."),
      dateFiltersExplicit: z.boolean().optional().describe("Only set true when the user explicitly requested date constraints."),
      // Common filters
      filters: z
        .object({
          jurisdiccion: z.string().optional(),
          tribunal: z.string().optional(),
          materia: z.string().optional(),
          promulgacion_from: z.string().optional(),
          promulgacion_to: z.string().optional(),
          publicacion_from: z.string().optional(),
          publicacion_to: z.string().optional(),
          document_id: z.string().optional().describe("Document ID for exact match"),
        })
        .optional(),
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
        const strictFilters = args.strictFilters === true;
        const dateFiltersExplicit = args.dateFiltersExplicit === true;
        
        // Normalize and apply jurisdiccion filter (only if provided and not empty)
        const normalizedJurisdiccion = normalizeJurisdiccion(filters.jurisdiccion);
        if (normalizedJurisdiccion) {
          qdrantFilters.jurisdiccion = normalizedJurisdiccion;
          console.log(`🔧 [Jurisdiction] Fallos: Normalized "${filters.jurisdiccion}" -> "${normalizedJurisdiccion}"`);
        } else if (filters.jurisdiccion !== undefined && filters.jurisdiccion !== null) {
          console.log(`⚠️  [Jurisdiction] Fallos: Empty jurisdiction filter provided, omitting: "${filters.jurisdiccion}"`);
        }

        // Always-allowed filters
        if (filters.document_id) qdrantFilters.document_id = filters.document_id;

        // Strict filters (only when explicitly requested)
        if (strictFilters) {
          if (filters.tribunal) qdrantFilters.tribunal = filters.tribunal;
          if (filters.materia) qdrantFilters.materia = filters.materia;
        } else {
          if (filters.tribunal || filters.materia) {
            console.log("ℹ️ [Filters] Ignoring strict filters (tribunal/materia) because strictFilters is not true");
          }
        }

        
        // Date filters - convert ISO dates to timestamps.
        // IMPORTANT: ignore wide default ranges (1900..2100) to avoid filtering out docs that don't have these fields.
        // Also ignore ALL date filters unless dateFiltersExplicit=true.
        try {
          if (dateFiltersExplicit) {
            if (!isNoOpDateFilterValue(filters.promulgacion_from)) {
              qdrantFilters.sanction_date_from = isoToTimestamp(filters.promulgacion_from);
            }
            if (!isNoOpDateFilterValue(filters.promulgacion_to)) {
              qdrantFilters.sanction_date_to = isoToTimestamp(filters.promulgacion_to);
            }
            if (!isNoOpDateFilterValue(filters.publicacion_from)) {
              qdrantFilters.publication_date_from = isoToTimestamp(filters.publicacion_from);
            }
            if (!isNoOpDateFilterValue(filters.publicacion_to)) {
              qdrantFilters.publication_date_to = isoToTimestamp(filters.publicacion_to);
            }
          } else {
            if (filters.promulgacion_from || filters.promulgacion_to || filters.publicacion_from || filters.publicacion_to) {
              console.log("ℹ️ [Filters] Ignoring date filters because dateFiltersExplicit is not true");
            }
          }
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
        let results = await ctx.runAction(
          internal.rag.qdrantUtils.fallos.searchFallos,
          { 
            query,
            filters: Object.keys(qdrantFilters).length > 0 ? qdrantFilters : undefined
          }
        );

        // If nothing found, retry once with relaxed filters (drop the most failure-prone strict filters).
        // This prevents "0 results" when filters are overly strict or auto-filled.
        let searchNotes: Array<string> = [];
        if (results.length === 0 && Object.keys(qdrantFilters).length > 0) {
          const relaxedFilters: any = { ...qdrantFilters };
          // Drop strict filters that commonly kill recall:
          delete relaxedFilters.materia;
          delete relaxedFilters.publication_date_from;
          delete relaxedFilters.publication_date_to;
          delete relaxedFilters.sanction_date_from;
          delete relaxedFilters.sanction_date_to;

          const relaxedKeys = Object.keys(relaxedFilters);
          if (relaxedKeys.length < Object.keys(qdrantFilters).length) {
            searchNotes.push("⚠️ Sin resultados con filtros estrictos; reintentando sin materia/fechas.");
            results = await ctx.runAction(internal.rag.qdrantUtils.fallos.searchFallos, {
              query,
              filters: relaxedKeys.length > 0 ? relaxedFilters : undefined,
            });
          }

          // Final fallback: if still empty and we had filters (other than document_id), try without any filters.
          if (results.length === 0 && relaxedKeys.length > 0 && !relaxedFilters.document_id) {
            searchNotes.push("⚠️ Sin resultados tras reintento; reintentando sin filtros.");
            results = await ctx.runAction(internal.rag.qdrantUtils.fallos.searchFallos, { query });
          }
        }

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
          url: r.payload.url,
        }));

        // Build citations array (tool-controlled, UI expects citationType === "fallo")
        const citations = results.map((r) => ({
          id: r.payload.document_id,
          type: "fallo" as const,
          title:
            r.payload.title ||
            `${r.payload.tribunal} - ${r.payload.actor} vs ${r.payload.demandado}`.trim() ||
            "Fallo",
          url: r.payload.url ?? undefined,
        }));

        const markdown = `# 🔍 Resultados de Búsqueda de Fallos

## Consulta
${args.query ? `**Término de búsqueda**: "${query}"` : `**Búsqueda por ID**: ${qdrantFilters.document_id || 'N/A'}`}
${Object.keys(qdrantFilters).length > 0 ? `\n## Filtros Aplicados\n${Object.entries(qdrantFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}` : ''}

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}
${searchNotes.length > 0 ? `\n## Notas\n${searchNotes.map((n) => `- ${n}`).join("\n")}` : ""}

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
${r.url ? `- **URL**: ${r.url}` : ''}
`).join('\n')}

---
*Búsqueda realizada en la base de datos de fallos.*`;

        return { markdown, citations };
      }

      case "browse": {
        // Keep browse simple for agents: fixed pagination.
        const limit = 20;
        const offset = 0;
        const sortBy = undefined;
        const sortOrder = "desc";
        const filters = args.filters || {};

        // Normalize jurisdiccion filter for browse operation
        const normalizedFilters = { ...filters };
        const normalizedJurisdiccion = normalizeJurisdiccion(filters.jurisdiccion);
        if (normalizedJurisdiccion) {
          normalizedFilters.jurisdiccion = normalizedJurisdiccion;
          console.log(`🔧 [Jurisdiction] Fallos browse: Normalized "${filters.jurisdiccion}" -> "${normalizedJurisdiccion}"`);
        } else if (filters.jurisdiccion !== undefined && filters.jurisdiccion !== null) {
          delete normalizedFilters.jurisdiccion;
          console.log(`⚠️  [Jurisdiction] Fallos browse: Empty jurisdiction filter provided, omitting: "${filters.jurisdiccion}"`);
        }

        const result = await ctx.runAction(api.functions.fallos.listFallos, {
          filters: normalizedFilters,
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
${Object.keys(normalizedFilters).length > 0 ? Object.entries(normalizedFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

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

        // Normalize jurisdiccion filter for facets operation
        const normalizedFilters = { ...filters };
        const normalizedJurisdiccion = normalizeJurisdiccion(filters.jurisdiccion);
        if (normalizedJurisdiccion) {
          normalizedFilters.jurisdiccion = normalizedJurisdiccion;
          console.log(`🔧 [Jurisdiction] Fallos facets: Normalized "${filters.jurisdiccion}" -> "${normalizedJurisdiccion}"`);
        } else if (filters.jurisdiccion !== undefined && filters.jurisdiccion !== null) {
          delete normalizedFilters.jurisdiccion;
          console.log(`⚠️  [Jurisdiction] Fallos facets: Empty jurisdiction filter provided, omitting: "${filters.jurisdiccion}"`);
        }

        const facets = await ctx.runAction(api.functions.fallos.getFallosFacets, { filters: normalizedFilters });
        return `# 📊 Facetas de Fallos

## Filtros Aplicados
${Object.keys(normalizedFilters).length > 0 ? Object.entries(normalizedFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n') : 'Sin filtros aplicados'}

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
