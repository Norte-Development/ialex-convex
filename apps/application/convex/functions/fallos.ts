'use node'

import { action } from "../_generated/server";
import { v } from "convex/values";
import { 
  getFallos as getFallosService, 
  getFalloById as getFalloByIdService,
  getFallosFacets as getFallosFacetsService,
  getTipoGeneralValues as getTipoGeneralValuesService,
  getJurisdiccionValues as getJurisdiccionValuesService,
  clearFallosCache as clearFallosCacheService,
} from "../utils/fallosService";
import { FalloDoc, ListFallosParams, PaginatedResult } from "../../types/fallos";

// Validator for EstadoFallo enum
const estadoFalloValidator = v.union(
  v.literal("vigente"),
  v.literal("derogada"), 
  v.literal("caduca"),
  v.literal("anulada"),
  v.literal("suspendida"),
  v.literal("abrogada"),
  v.literal("sin_registro_oficial")
);

// Validator for TipoContenidoFallo enum
const tipoContenidoFalloValidator = v.union(
  v.literal("leg"),
  v.literal("jur"),
  v.literal("adm")
);

// TipoGeneralFallo validator - uses string since values are dynamically loaded from MongoDB
const tipoGeneralFalloValidator = v.string();

// Validator for FalloSortBy enum
const falloSortByValidator = v.union(
  v.literal("fecha"),
  v.literal("promulgacion"),
  v.literal("publicacion"),
  v.literal("relevancia"),
  v.literal("created_at"),
  v.literal("updated_at")
);

// Validator for FalloSortOrder enum
const falloSortOrderValidator = v.union(
  v.literal("asc"),
  v.literal("desc")
);

// Validator for fallo filters
const falloFiltersValidator = v.optional(v.object({
  jurisdiccion: v.optional(v.string()),
  tribunal: v.optional(v.string()),
  materia: v.optional(v.string()),
  estado: v.optional(estadoFalloValidator),
  fecha_from: v.optional(v.string()),
  fecha_to: v.optional(v.string()),
  promulgacion_from: v.optional(v.string()),
  promulgacion_to: v.optional(v.string()),
  publicacion_from: v.optional(v.string()),
  publicacion_to: v.optional(v.string()),
  actor: v.optional(v.string()),
  demandado: v.optional(v.string()),
  magistrados: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  search: v.optional(v.string()),
  document_id: v.optional(v.string()),
  tipo_contenido: v.optional(tipoContenidoFalloValidator),
  tipo_general: v.optional(tipoGeneralFalloValidator),
  sala: v.optional(v.string())
}));

export const listFallos = action({
  args: {
    filters: falloFiltersValidator,
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(falloSortByValidator),
    sortOrder: v.optional(falloSortOrderValidator)
  },
  returns: v.object({
    items: v.array(v.any()), // We'll use v.any() for the complex FalloDoc structure
    pagination: v.object({
      page: v.number(),
      limit: v.number(),
      total: v.number(),
      totalPages: v.number(),
      hasNext: v.boolean(),
      hasPrev: v.boolean()
    })
  }),
  handler: async (ctx, args): Promise<PaginatedResult<FalloDoc>> => {
    const params: ListFallosParams = {
      filters: args.filters || {},
      limit: args.limit || 20,
      offset: args.offset || 0,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder || 'desc'
    };

    return await getFallosService(params);
  }
});

export const getFallo = action({
  args: {
    documentId: v.string()
  },
  returns: v.union(v.any(), v.null()), // FalloDoc or null
  handler: async (ctx, args): Promise<FalloDoc | null> => {
    return await getFalloByIdService(args.documentId);
  }
});

export const getFallosFacets = action({
  args: {
    filters: falloFiltersValidator
  },
  returns: v.object({
    jurisdicciones: v.any(), // Record<string, number>
    tribunales: v.any(), // Record<string, number>
    materias: v.any(), // Record<string, number>
    estados: v.any(), // Record<string, number>
    tags: v.any() // Record<string, number>
  }),
  handler: async (ctx, args) => {
    return await getFallosFacetsService(args.filters || {});
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

export const clearFallosCache = action({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    clearFallosCacheService();
    return null;
  }
});
