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
          if (queryError) return { kind: "error", error: queryError.error };
          const query = args.query.trim();

        // Use hybrid Qdrant search
        const results = await ctx.runAction(
          internal.rag.qdrantUtils.legislation.searchNormatives,
          { query }
        );

        // Map to compact search response with snippet and relations count
        return {
          kind: "search",
          query,
          resultsCount: results.length,
          results: results.map((r, i: number) => ({
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
          })),
        };
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

        return {
          kind: "browse",
          items: lightweightItems,
          pagination: result.pagination,
        };
      }

      case "facets": {
        const filters = args.filters || {};
        const facets = await ctx.runAction(api.functions.legislation.getNormativesFacets, { filters });
        return { kind: "facets", facets };
      }

        case "metadata": {
          const documentIdError = validateStringParam(args.documentId, "documentId");
          if (documentIdError) return { kind: "error", error: documentIdError.error };
          const documentId = args.documentId.trim();

        const normative = await ctx.runAction(api.functions.legislation.getNormativeById, {
          jurisdiction: args.filters?.jurisdiccion || "",
          id: documentId,
        });

        if (!normative) {
          return { kind: "metadata", documentId, notFound: true };
        }

        // Compute presence flags
        const hasContent = Boolean(normative.content || normative.texto || (Array.isArray(normative.articulos) && normative.articulos.length > 0));
        const relationsCount = Array.isArray(normative.relaciones) ? normative.relaciones.length : 0;

        // Return metadata without large fields
        const {
          content, texto, articulos, aprobacion, relaciones, created_at, updated_at, content_hash,
          ...rest
        } = normative;

        return {
          kind: "metadata",
          documentId,
          hasContent,
          relationsCount,
          normative: rest,
        };
      }

        default:
          return { kind: "error", error: `Unsupported operation: ${operation}` };
      }
    } catch (error) {
      return { kind: "error", error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },
} as any);


