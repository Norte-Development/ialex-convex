'use node'

import { action } from "../_generated/server";
import { v } from "convex/values";
import { LegislationService } from "../utils/legislationService";
import { Estado } from "../../types/legislation";
import { NormativeFilters } from "../../types/legislation";

const legislationService = new LegislationService();

// Corpus-level semantic search
export const searchNormatives = action({
  args: {
    jurisdiction: v.string(),
    query: v.string(),
    filters: v.optional(v.object({
      tipo: v.optional(v.string()),
      provincia: v.optional(v.string()),
      estado: v.optional(v.string()),
      promulgacion_from: v.optional(v.string()),
      promulgacion_to: v.optional(v.string()),
      vigencia_actual: v.optional(v.boolean()),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.searchNormativesCorpus(args.jurisdiction, {
        query: args.query,
        tipo: args.filters?.tipo,
        provincia: args.filters?.provincia,
        estado: args.filters?.estado as Estado,
        promulgacion_from: args.filters?.promulgacion_from,
        promulgacion_to: args.filters?.promulgacion_to,
        vigencia_actual: args.filters?.vigencia_actual,
        limit: args.limit || 10,
      });
    } catch (error) {
      console.error("Error in searchNormatives:", error);
      throw new Error(`Failed to search normatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Intra-document semantic search
export const queryNormatives = action({
  args: {
    jurisdiction: v.string(),
    query: v.string(),
    normative_ids: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.searchNormativeChunks(args.jurisdiction, {
        query: args.query,
        normative_ids: args.normative_ids,
        limit: args.limit || 10,
      });
    } catch (error) {
      console.error("Error in queryNormatives:", error);
      throw new Error(`Failed to query normatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Get full normative by ID
export const getNormative = action({
  args: { 
    jurisdiction: v.string(),
    id: v.string() 
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.getNormative(args.jurisdiction, args.id);
    } catch (error) {
      console.error("Error in getNormative:", error);
      throw new Error(`Failed to get normative: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// List normatives with filters
export const listNormatives = action({
  args: {
    jurisdiction: v.optional(v.string()),
    filters: v.optional(v.object({
      tipo: v.optional(v.string()),
      provincia: v.optional(v.string()),
      estado: v.optional(v.string()),
      promulgacion_from: v.optional(v.string()),
      promulgacion_to: v.optional(v.string()),
      vigencia_actual: v.optional(v.boolean()),
    })),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc")))
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.listNormatives(args.jurisdiction || "nacional", {
        filters: args.filters as NormativeFilters,
        limit: args.limit || 50,
        offset: args.offset || 0,
        sortBy: args.sortBy as any,
        sortOrder: (args.sortOrder as any) || "desc",
      });
    } catch (error) {
      console.error("Error in listNormatives:", error);
      throw new Error(`Failed to list normatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Get related normatives
export const getRelatedNormatives = action({
  args: { 
    jurisdiction: v.string(),
    id: v.string() 
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.getRelatedNormatives(args.jurisdiction, args.id);
    } catch (error) {
      console.error("Error in getRelatedNormatives:", error);
      throw new Error(`Failed to get related normatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Test external service connections for a specific jurisdiction
export const testLegislationConnections = action({
  args: { jurisdiction: v.string() },
  handler: async (ctx, args) => {
    try {
      return await legislationService.testConnections(args.jurisdiction);
    } catch (error) {
      console.error("Error in testLegislationConnections:", error);
      throw new Error(`Failed to test connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Get available jurisdictions
export const getAvailableJurisdictions = action({
  args: {},
  handler: async (ctx, args) => {
    try {
      return await legislationService.getAvailableJurisdictions();
    } catch (error) {
      console.error("Error in getAvailableJurisdictions:", error);
      throw new Error(`Failed to get available jurisdictions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Get facets for filters
export const getNormativesFacets = action({
  args: {
    jurisdiction: v.string(),
    filters: v.optional(v.object({
      tipo: v.optional(v.string()),
      provincia: v.optional(v.string()),
      estado: v.optional(v.string()),
      promulgacion_from: v.optional(v.string()),
      promulgacion_to: v.optional(v.string()),
      vigencia_actual: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    try {
      return await legislationService.getNormativesFacets(args.jurisdiction, args.filters as any);
    } catch (error) {
      console.error("Error in getNormativesFacets:", error);
      throw new Error(`Failed to get facets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});
