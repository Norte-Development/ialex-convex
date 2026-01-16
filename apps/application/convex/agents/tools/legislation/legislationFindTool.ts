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
 * Normalizes jurisdiction values to the correct format.
 * Handles case variations and common synonyms for "nacional" -> "nac"
 * Returns null/undefined if jurisdiction should be omitted (empty string, whitespace, etc.)
 */
function normalizeJurisdiccion(jurisdiccion: string | undefined | null): string | undefined {
  if (!jurisdiccion) return undefined;
  
  const normalized = jurisdiccion.trim().toLowerCase();
  
  // If empty after trimming, return undefined to omit the filter
  if (normalized === '') return undefined;
  
  // Map common variations of "nacional" to "nac"
  const nacionalVariations = [
    'nacional',
    'nación',
    'nacion',
    'argentina',
    'argentino',
    'federal',
    'nación argentina',
    'república argentina',
    'república',
  ];
  
  if (nacionalVariations.includes(normalized)) {
    return 'nac';
  }
  
  // Return the normalized value as-is (should be a valid province code)
  // The tool description will validate against available jurisdiccion values
  return normalized;
}

/**
 * Treats "default" date range values (often auto-filled by UI/LLM) as NO-OP.
 * Wide ranges can unintentionally exclude documents missing date fields because Qdrant uses MUST range filters.
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
 * Unified legislation finder tool.
 * Operations:
 * - search: Hybrid search in Qdrant with optional Mongo filters
 * - browse: Mongo-only filtered/paginated list (fast browse, no large fields)
 * - facets: Mongo facet counts for UI/filters
 * - metadata: Single document metadata (no large content fields)
 */

/**
 * Schema for legislationFindTool arguments.
 * NOTE: All fields have defaults so the generated JSON Schema
 * has complete `required` arrays, avoiding provider schema errors.
 */
const legislationFindToolArgs = z.object({
  operation: z
    .enum(["search", "browse", "facets", "metadata"])
    .describe("Which operation to perform"),
  // Controls to reduce over-filtering by the model
  strictFilters: z
    .boolean()
    .default(false)
    .describe("Only set true when the user explicitly requested strict filters (estado/tipo_general)."),
  dateFiltersExplicit: z
    .boolean()
    .default(false)
    .describe("Only set true when the user explicitly requested date constraints."),
  // Browse/pagination controls
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of documents to return for browse (default: 20)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination in browse (default: 0)"),
  sortBy: z
    .enum(["sanction_date", "updated_at", "created_at", "relevancia"])
    .default("sanction_date")
    .describe("Sort field for browse (sanction_date, updated_at, created_at, relevancia)"),
  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc")
    .describe("Sort order for browse (asc/desc)"),
  // Common filters (all fields have safe defaults; empty values mean 'no filter')
  filters: z
    .object({
      jurisdiccion: z
        .string()
        .default("nac")
        .describe("Jurisdiction code or empty string to omit"),
      tipo_general: z
        .string()
        .default("")
        .describe("Tipo general or empty string to omit"),
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
        .default("vigente")
        .describe("Estado de la norma; default 'vigente'"),
      sanction_date_from: z.string().default(""),
      sanction_date_to: z.string().default(""),
      publication_date_from: z.string().default(""),
      publication_date_to: z.string().default(""),
      number: z
        .union([z.number(), z.string()])
        .nullable()
        .default(null)
        .describe("Law number (use only numeric part, e.g., 7302 for law 7302/2024)"),
    }),
  // Search-specific (optional when filtering by number) - empty string means "not provided"
  query: z
    .string()
    .default("")
    .describe("Search query text - optional when using number filter"),
  // Metadata
  documentId: z
    .string()
    .default("")
    .describe("Document ID for metadata operations"),
});

type LegislationFindToolArgs = z.infer<typeof legislationFindToolArgs>;

/**
 * Filters object shape expected by getNormatives/getNormativesFacets.
 * This matches the server-side filtersValidator but only includes
 * the fields we actually use from the tool.
 */
type NormativesFiltersInput = {
  jurisdiccion?: string;
  tipo_general?: string;
  estado?:
    | "vigente"
    | "derogada"
    | "caduca"
    | "anulada"
    | "suspendida"
    | "abrogada"
    | "sin_registro_oficial";
  sanction_date_from?: string;
  sanction_date_to?: string;
  publication_date_from?: string;
  publication_date_to?: string;
  number?: number;
};

function buildNormativesFiltersFromArgsFilters(
  filters: LegislationFindToolArgs["filters"],
): NormativesFiltersInput {
  const result: NormativesFiltersInput = {};

  const normalizedJurisdiccion = normalizeJurisdiccion(filters.jurisdiccion);
  if (normalizedJurisdiccion) {
    result.jurisdiccion = normalizedJurisdiccion;
  }

  if (filters.tipo_general && filters.tipo_general.trim() !== "") {
    result.tipo_general = filters.tipo_general.trim();
  }

  if (filters.estado) {
    result.estado = filters.estado;
  }

  if (filters.sanction_date_from) {
    result.sanction_date_from = filters.sanction_date_from;
  }

  if (filters.sanction_date_to) {
    result.sanction_date_to = filters.sanction_date_to;
  }

  if (filters.publication_date_from) {
    result.publication_date_from = filters.publication_date_from;
  }

  if (filters.publication_date_to) {
    result.publication_date_to = filters.publication_date_to;
  }

  if (filters.number != null) {
    const raw = String(filters.number);
    const match = raw.match(/^\d+/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (!Number.isNaN(parsed)) {
        result.number = parsed;
      }
    }
  }

  return result;
}

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
    
    return `Find legislation: hybrid search with optional filters, browse by filters, fetch facets, or get metadata. 

IMPORTANT: You can search by number alone without a query - just provide filters.number with the numeric part (e.g., 7302 for law 7302/2024). Query is optional when filtering by number.

IMPORTANT (DATES): Avoid date filters unless the user explicitly specifies dates. If you MUST use date filters, set dateFiltersExplicit=true.
IMPORTANT (STRICT FILTERS): Avoid strict filters unless the user explicitly asks (e.g. estado/tipo_general). If you MUST use strict filters, set strictFilters=true.

FILTERS:
- jurisdiccion: Jurisdiction. ${jurisdiccionList}. CRITICAL: If no jurisdiction is mentioned or specified by the user, LEAVE THIS FILTER EMPTY (do not include it in filters object). Only use jurisdiccion when explicitly mentioned. Valid values are province codes or "nac" for nacional. Common variations like "Nacional", "Argentina", "nacional" will be automatically normalized to "nac".
- tipo_general (STRICT): Type of legislation. ${tipoGeneralList}
- estado (STRICT): Status (vigente, derogada, caduca, anulada, suspendida, abrogada, sin_registro_oficial)
- number: Law number (use only numeric part)
- sanction_date_from/to (DATES): Sanction date range (ISO date strings)
- publication_date_from/to (DATES): Publication date range (ISO date strings)`;
  },
  args: legislationFindToolArgs,
  handler: async (ctx: ToolCtx, args: LegislationFindToolArgs) => {
    try {

      console.log("args", args);

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
          console.log(`🔧 [Jurisdiction] Normalized "${filters.jurisdiccion}" -> "${normalizedJurisdiccion}"`);
        } else if (filters.jurisdiccion !== undefined && filters.jurisdiccion !== null) {
          // Log when jurisdiction was provided but normalized to empty (shouldn't happen with proper prompt)
          console.log(`⚠️  [Jurisdiction] Empty jurisdiction filter provided, omitting: "${filters.jurisdiccion}"`);
        }
        // Strict filters (only when explicitly requested)
        if (strictFilters) {
          if (filters.tipo_general) qdrantFilters.tipo_general = filters.tipo_general;
          if (filters.estado) qdrantFilters.estado = filters.estado;
        } else {
          if (filters.tipo_general || filters.estado) {
            console.log("ℹ️ [Filters] Ignoring strict filters (tipo_general/estado) because strictFilters is not true");
          }
        }
        
        // Number filter (will use OR logic in Qdrant for number and numero fields)
        if (filters.number) {
          // Extract numeric part if it's a string like "7302/2024"
          const numberStr = String(filters.number);
          const match = numberStr.match(/^\d+/);
          qdrantFilters.number = match ? match[0] : numberStr;
        }
        
        // Date filters (pass as date strings - Qdrant will convert to timestamps)
        // IMPORTANT: ignore wide default ranges (1900..2100) to avoid filtering out docs that don't have these fields.
        if (dateFiltersExplicit) {
          if (!isNoOpDateFilterValue(filters.sanction_date_from)) qdrantFilters.sanction_date_from = filters.sanction_date_from;
          if (!isNoOpDateFilterValue(filters.sanction_date_to)) qdrantFilters.sanction_date_to = filters.sanction_date_to;
          if (!isNoOpDateFilterValue(filters.publication_date_from)) qdrantFilters.publication_date_from = filters.publication_date_from;
          if (!isNoOpDateFilterValue(filters.publication_date_to)) qdrantFilters.publication_date_to = filters.publication_date_to;
        } else {
          if (filters.sanction_date_from || filters.sanction_date_to || filters.publication_date_from || filters.publication_date_to) {
            console.log("ℹ️ [Filters] Ignoring date filters because dateFiltersExplicit is not true");
          }
        }

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
        let results = await ctx.runAction(
          internal.rag.qdrantUtils.legislation.searchNormatives,
          { 
            query,
            filters: Object.keys(qdrantFilters).length > 0 ? qdrantFilters : undefined
          }
        );

        // If nothing found, retry once by removing the most failure-prone strict filters (dates).
        // This helps when UI/LLM auto-fills broad date ranges which can exclude docs lacking date fields.
        let searchNotes: Array<string> = [];
        if (results.length === 0 && Object.keys(qdrantFilters).length > 0) {
          const relaxedFilters: any = { ...qdrantFilters };
          const hadDateFilters =
            "sanction_date_from" in relaxedFilters ||
            "sanction_date_to" in relaxedFilters ||
            "publication_date_from" in relaxedFilters ||
            "publication_date_to" in relaxedFilters;

          delete relaxedFilters.sanction_date_from;
          delete relaxedFilters.sanction_date_to;
          delete relaxedFilters.publication_date_from;
          delete relaxedFilters.publication_date_to;

          if (hadDateFilters) {
            searchNotes.push("⚠️ Sin resultados con filtros de fecha; reintentando sin fechas.");
            results = await ctx.runAction(internal.rag.qdrantUtils.legislation.searchNormatives, {
              query,
              filters: Object.keys(relaxedFilters).length > 0 ? relaxedFilters : undefined,
            });
          }
        }

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
        }));

        // Build citations array from results (tool-controlled, not LLM-dependent)
        console.log(`📚 [Citations] Creating citations from ${results.length} legislation search results`);
        const citations = results.map((r) => {
          const citation = {
            id: r.document_id || r.id,
            type: 'leg' as const,
            title: r.title || `${r.tipo_general || ''} ${r.number || ''}`.trim() || 'Normativa',
            url: r.url ?? undefined,
          };
          console.log(`  📖 Citation created:`, citation);
          return citation;
        });
        console.log(`✅ [Citations] Total citations created: ${citations.length}`);

        // Build markdown summary
        const markdown = `# 🔍 Resultados de Búsqueda Legislativa

## Consulta
${args.query ? `**Término de búsqueda**: "${query}"` : `**Búsqueda por número**: ${qdrantFilters.number || 'N/A'}`}
${Object.keys(qdrantFilters).length > 0 ? `\n## Filtros Aplicados\n${Object.entries(qdrantFilters).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}` : ''}

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}
${searchNotes.length > 0 ? `\n## Notas\n${searchNotes.map((n) => `- ${n}`).join("\n")}` : ""}

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

        // Return structured JSON with markdown and citations
        console.log(`📤 [Citations] Returning tool output with ${citations.length} citations`);
        return { markdown, citations };
      }

      case "browse": {
        const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 100) : 20;
        const offset = typeof args.offset === "number" ? Math.max(0, args.offset) : 0;
        const sortBy = args.sortBy as "sanction_date" | "updated_at" | "created_at" | "relevancia";
        const sortOrder = args.sortOrder ?? "desc";
        const filters = args.filters;
        
        // Normalize jurisdiccion filter for browse operation
        const normalizedFilters: NormativesFiltersInput =
          buildNormativesFiltersFromArgsFilters(filters);

        const result = await ctx.runAction(api.functions.legislation.getNormatives, {
          filters: normalizedFilters,
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
        const filters = args.filters;
        const normalizedFilters: NormativesFiltersInput =
          buildNormativesFiltersFromArgsFilters(filters);
        const facets = await ctx.runAction(api.functions.legislation.getNormativesFacets, {
          filters: normalizedFilters,
        });
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


