'use node'

import { action } from "../_generated/server";
import { v } from "convex/values";
import { 
  getNormatives as getNormativesService, 
  getNormativeById as getNormativeByIdService,
  getNormativesFacets as getNormativesFacetsService,
  getTipoGeneralValues as getTipoGeneralValuesService,
  getJurisdiccionValues as getJurisdiccionValuesService,
  PaginatedResult 
} from "../utils/legislationService";
import { Estado, NormativeDoc, ListNormativesParams } from "../../types/legislation";

// Validator for Estado enum
const estadoValidator = v.union(
  v.literal("vigente"),
  v.literal("derogada"), 
  v.literal("caduca"),
  v.literal("anulada"),
  v.literal("suspendida"),
  v.literal("abrogada"),
  v.literal("sin_registro_oficial")
);

// Validator for Subestado enum
const subestadoValidator = v.union(
  v.literal("alcance_general"),
  v.literal("individual_modificatoria_o_sin_eficacia"),
  v.literal("vetada"),
  v.literal("derogada"),
  v.literal("abrogada_implicita"),
  v.literal("ley_caduca"),
  v.literal("refundida_ley_caduca"),
  v.literal("sin_registro")
);

// TipoGeneral validator - uses string since values are dynamically loaded from MongoDB
const tipoGeneralValidator = v.string();

// Validator for TipoDetalle enum
const tipoDetalleValidator = v.union(
  v.literal("Ley"),
  v.literal("Decreto"),
  v.literal("Resolucion"),
  v.literal("Ordenanza"),
  v.literal("Reglamento")
);

// Validator for TipoContenido enum
const tipoContenidoValidator = v.union(
  v.literal("leg"),
  v.literal("jur"),
  v.literal("adm")
);

// Validator for SortBy enum
const sortByValidator = v.union(
  v.literal("sanction_date"),
  v.literal("updated_at"),
  v.literal("created_at"),
  v.literal("relevancia")
);

// Validator for SortOrder enum
const sortOrderValidator = v.union(
  v.literal("asc"),
  v.literal("desc")
);

// Validator for filters
const filtersValidator = v.optional(v.object({
  type: v.optional(v.string()),
  jurisdiccion: v.optional(v.string()),
  estado: v.optional(estadoValidator),
  subestado: v.optional(subestadoValidator),
  tipo_general: v.optional(tipoGeneralValidator),
  tipo_detalle: v.optional(tipoDetalleValidator),
  tipo_contenido: v.optional(tipoContenidoValidator),
  sanction_date_from: v.optional(v.string()),
  sanction_date_to: v.optional(v.string()),
  publication_date_from: v.optional(v.string()),
  publication_date_to: v.optional(v.string()),
  number: v.optional(v.number()),
  search: v.optional(v.string()),
  vigencia_actual: v.optional(v.boolean()),
  // New fields from payload
  content_hash: v.optional(v.string()),
  date_ts_from: v.optional(v.number()),
  date_ts_to: v.optional(v.number()),
  sanction_ts_from: v.optional(v.number()),
  sanction_ts_to: v.optional(v.number()),
  publication_ts_from: v.optional(v.number()),
  publication_ts_to: v.optional(v.number()),
  fuente: v.optional(v.string()),
  country_code: v.optional(v.string()),
  document_id: v.optional(v.string())
}));

export const getNormatives = action({
  args: {
    filters: filtersValidator,
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(sortByValidator),
    sortOrder: v.optional(sortOrderValidator)
  },
  returns: v.object({
    items: v.array(v.any()), // We'll use v.any() for the complex NormativeDoc structure
    pagination: v.object({
      page: v.number(),
      limit: v.number(),
      total: v.number(),
      totalPages: v.number(),
      hasNext: v.boolean(),
      hasPrev: v.boolean()
    })
  }),
  handler: async (ctx, args): Promise<PaginatedResult<NormativeDoc>> => {
    const params: ListNormativesParams = {
      filters: args.filters || {},
      limit: args.limit || 20,
      offset: args.offset || 0,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder || 'desc'
    };

    return await getNormativesService(params);
  }
});

export const getNormativeById = action({
  args: {
    jurisdiction: v.string(),
    id: v.string()
  },
  returns: v.union(v.any(), v.null()), // NormativeDoc or null
  handler: async (ctx, args): Promise<NormativeDoc | null> => {
    // Construct documentId from jurisdiction and id
    const documentId = args.id;
    return await getNormativeByIdService(documentId);
  }
});

export const getNormativesFacets = action({
  args: {
    filters: filtersValidator
  },
  returns: v.object({
    jurisdicciones: v.any(), // Record<string, number>
    tipos: v.any(), // Record<string, number>
    estados: v.any(), // Record<string, number>
    years: v.any() // Record<number, number>
  }),
  handler: async (ctx, args) => {
    return await getNormativesFacetsService(args.filters || {});
  }
});

export const getTipoGeneralValues = action({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    return await getTipoGeneralValuesService();
  }
});

export const getJurisdiccionValues = action({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    return await getJurisdiccionValuesService();
  }
});