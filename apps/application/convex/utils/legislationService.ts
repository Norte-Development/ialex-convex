'use node'

import { MongoClient } from 'mongodb';
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import qdrantClient from "../rag/qdrant";
import {
  CorpusSearchParams,
  IntraDocSearchParams,
  SearchResult,
  ChunkSearchResult,
  NormativeDoc,
  Relacion,
  NormativeFilters,
  ListNormativesParams,
  Estado,
  NormativesFacets,
  SortBy,
  SortOrder
} from "../../types/legislation";

// External service clients - lazy initialization
let mongoClient: MongoClient | null = null;

// Lazy getter for MongoDB client
const getMongoClient = (): MongoClient => {
  if (!mongoClient) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    mongoClient = new MongoClient(process.env.MONGODB_URI);
  }
  return mongoClient;
};

// Qdrant collection naming convention for legislation
const getNormativesCollectionName = (jurisdiction: string) => `legislacion_${jurisdiction}`;
const getChunksCollectionName = (jurisdiction: string) => `legislacion_${jurisdiction}_chunks`;

// MongoDB collection naming convention
const getMongoCollectionName = (jurisdiction: string) => `legislacion_${jurisdiction}`;

export class LegislationService {
  private db: any;

  constructor() {
    this.db = getMongoClient().db('ialex_legislation');
  }

  // Get MongoDB collection for a specific jurisdiction
  private getNormativesCollection(jurisdiction: string) {
    return this.db.collection(getMongoCollectionName(jurisdiction));
  }

  // Ensure returned objects are Convex-serializable (no ObjectId, no Date)
  private sanitizeNormative(doc: any): NormativeDoc {
    if (!doc) return doc;
    const { _id, created_at, updated_at, ...rest } = doc;
    const created = created_at instanceof Date ? created_at.toISOString() : created_at;
    const updated = updated_at instanceof Date ? updated_at.toISOString() : updated_at;
    return {
      ...rest,
      ...(created ? { created_at: created } : {}),
      ...(updated ? { updated_at: updated } : {}),
    } as NormativeDoc;
  }

  private buildMongoQuery(filters?: NormativeFilters) {
    const query: any = {};
    if (!filters) return query;
    if (filters.tipo) query.tipo = filters.tipo;
    if (filters.provincia) query.provincia = filters.provincia;
    if (filters.estado) query.estado = filters.estado;
    if (filters.vigencia_actual !== undefined) query.vigencia_actual = filters.vigencia_actual;
    if (filters.promulgacion_from || filters.promulgacion_to) {
      query.promulgacion = {};
      if (filters.promulgacion_from) query.promulgacion.$gte = filters.promulgacion_from;
      if (filters.promulgacion_to) query.promulgacion.$lte = filters.promulgacion_to;
    }
    return query;
  }

  private buildMongoSort(sortBy?: SortBy, sortOrder?: SortOrder) {
    if (!sortBy) return undefined;
    const order = sortOrder === "asc" ? 1 : -1;
    const sort: any = {};
    switch (sortBy) {
      case "promulgacion":
        sort.promulgacion = order;
        break;
      case "created_at":
        sort.created_at = order;
        break;
      case "updated_at":
        sort.updated_at = order;
        break;
      default:
        break;
    }
    return sort;
  }

  // Corpus-level semantic search using Qdrant for a specific jurisdiction
  async searchNormativesCorpus(jurisdiction: string, params: CorpusSearchParams): Promise<SearchResult[]> {
    const { query, tipo, provincia, estado, promulgacion_from, promulgacion_to, vigencia_actual, limit = 10 } = params;

    try {
      // Generate embedding for query
      const vector = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });

      // Build Qdrant filter
      const qdrantFilter: any = {};
      const mustConditions = [];
      
      if (tipo) {
        mustConditions.push({ key: "tipo", match: { value: tipo } });
      }
      if (provincia) {
        mustConditions.push({ key: "provincia", match: { value: provincia } });
      }
      if (estado) {
        mustConditions.push({ key: "estado", match: { value: estado } });
      }
      if (vigencia_actual !== undefined) {
        mustConditions.push({ key: "vigencia_actual", match: { value: vigencia_actual } });
      }
      if (promulgacion_from || promulgacion_to) {
        const rangeFilter: any = { key: "promulgacion", range: {} };
        if (promulgacion_from) rangeFilter.range.gte = promulgacion_from;
        if (promulgacion_to) rangeFilter.range.lte = promulgacion_to;
        mustConditions.push(rangeFilter);
      }

      if (mustConditions.length > 0) {
        qdrantFilter.must = mustConditions;
      }

      // Search Qdrant for the specific jurisdiction
      const collectionName = getNormativesCollectionName(jurisdiction);
      const searchResults = await qdrantClient.search(collectionName, {
        vector: vector.embedding,
        limit,
        filter: Object.keys(qdrantFilter).length > 0 ? qdrantFilter : undefined,
      });

      // Transform results
      return searchResults.map(result => ({
        id: result.payload?.id as string,
        tipo: result.payload?.tipo as string,
        titulo: result.payload?.titulo as string,
        resumen: result.payload?.resumen as string | undefined,
        score: result.score || 0,
        provincia: result.payload?.provincia as string | undefined,
        estado: result.payload?.estado as Estado,
        promulgacion: result.payload?.promulgacion as string | undefined,
        vigencia_actual: result.payload?.vigencia_actual as boolean | undefined,
      }));
    } catch (error) {
      console.error("Error in searchNormativesCorpus:", error);
      throw new Error(`Failed to search normatives corpus for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Intra-document semantic search using Qdrant for a specific jurisdiction
  async searchNormativeChunks(jurisdiction: string, params: IntraDocSearchParams): Promise<ChunkSearchResult[]> {
    const { query, normative_ids, limit = 10 } = params;

    try {
      // Generate embedding for query
      const vector = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });

      // Search Qdrant with normative_id filter for the specific jurisdiction
      const collectionName = getChunksCollectionName(jurisdiction);
      const searchResults = await qdrantClient.search(collectionName, {
        vector: vector.embedding,
        limit,
        filter: {
          must: [
            {
              key: "normative_id",
              match: {
                any: normative_ids
              }
            }
          ]
        }
      });

      // Transform results
      return searchResults.map(result => ({
        normative_id: result.payload?.normative_id as string,
        article: result.payload?.article as string | undefined,
        section: result.payload?.section as string | undefined,
        text: result.payload?.text as string,
        score: result.score || 0,
        chunk_index: result.payload?.chunk_index as number,
      }));
    } catch (error) {
      console.error("Error in searchNormativeChunks:", error);
      throw new Error(`Failed to search normative chunks for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get full normative from MongoDB for a specific jurisdiction
  async getNormative(jurisdiction: string, id: string): Promise<NormativeDoc | null> {
    try {
      const collection = this.getNormativesCollection(jurisdiction);
      const doc = await collection.findOne({ id });
      return doc ? this.sanitizeNormative(doc) : null;
    } catch (error) {
      console.error("Error in getNormative:", error);
      throw new Error(`Failed to get normative for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // List normatives with filters from MongoDB for a specific jurisdiction
  async listNormatives(jurisdiction: string, params: ListNormativesParams): Promise<{ items: NormativeDoc[]; total: number }> {
    const { filters, limit = 50, offset = 0, sortBy, sortOrder } = params;

    try {
      const collection = this.getNormativesCollection(jurisdiction);
      const query = this.buildMongoQuery(filters);
      const sort = this.buildMongoSort(sortBy, sortOrder);

      const [rawItems, total] = await Promise.all([
        collection
          .find(query)
          .sort(sort || {})
          .limit(limit)
          .skip(offset)
          .toArray(),
        collection.countDocuments(query)
      ]);

      const items = rawItems.map((doc: any) => this.sanitizeNormative(doc));
      return { items, total };
    } catch (error) {
      console.error("Error in listNormatives:", error);
      throw new Error(`Failed to list normatives for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getNormativesFacets(jurisdiction: string, filters?: NormativeFilters): Promise<NormativesFacets> {
    try {
      const collection = this.getNormativesCollection(jurisdiction);
      const match = this.buildMongoQuery(filters);

      const pipeline = [
        { $match: match },
        {
          $facet: {
            tipos: [
              { $group: { _id: "$tipo", count: { $sum: 1 } } },
            ],
            provincias: [
              { $group: { _id: "$provincia", count: { $sum: 1 } } },
            ],
            estados: [
              { $group: { _id: "$estado", count: { $sum: 1 } } },
            ],
          }
        }
      ];

      const [result] = await collection.aggregate(pipeline).toArray();

      const mapArrayToRecord = (arr: Array<{ _id: string; count: number }>) =>
        (arr || []).reduce((acc: Record<string, number>, cur) => {
          if (cur._id) acc[cur._id] = cur.count;
          return acc;
        }, {});

      return {
        tipos: mapArrayToRecord(result?.tipos || []),
        provincias: mapArrayToRecord(result?.provincias || []),
        estados: mapArrayToRecord(result?.estados || []),
      } as NormativesFacets;
    } catch (error) {
      console.error("Error in getNormativesFacets:", error);
      throw new Error(`Failed to get facets for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get related normatives from MongoDB for a specific jurisdiction
  async getRelatedNormatives(jurisdiction: string, id: string): Promise<Relacion[]> {
    try {
      const collection = this.getNormativesCollection(jurisdiction);
      const normative = await collection.findOne({ id });
      return normative?.relaciones || [];
    } catch (error) {
      console.error("Error in getRelatedNormatives:", error);
      throw new Error(`Failed to get related normatives for jurisdiction ${jurisdiction}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test connection to external services for a specific jurisdiction
  async testConnections(jurisdiction: string): Promise<{ mongodb: boolean; qdrant: boolean }> {
    const results = { mongodb: false, qdrant: false };

    try {
      // Test MongoDB connection
      await this.db.admin().ping();
      results.mongodb = true;
    } catch (error) {
      console.error("MongoDB connection test failed:", error);
    }

    try {
      // Test Qdrant connection and check if jurisdiction collections exist
      const collections = await qdrantClient.getCollections();
      const normativesCollectionName = getNormativesCollectionName(jurisdiction);
      const chunksCollectionName = getChunksCollectionName(jurisdiction);
      
      const collectionNames = collections.collections.map(c => c.name);
      results.qdrant = collectionNames.includes(normativesCollectionName) && collectionNames.includes(chunksCollectionName);
    } catch (error) {
      console.error("Qdrant connection test failed:", error);
    }

    return results;
  }

  // Get available jurisdictions by checking existing collections
  async getAvailableJurisdictions(): Promise<string[]> {
    // Do NOT query Qdrant for this. Use env or static defaults.
    const envList = process.env.LEGISLATION_JURISDICTIONS;
    if (envList && envList.trim().length > 0) {
      return envList
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return ["nacional", "buenos_aires", "caba", "cordoba", "santa_fe", "mendoza"];
  }
}
