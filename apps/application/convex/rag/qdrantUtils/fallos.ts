'use node'

import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { client } from "./client";
import { FalloSearchResult, FalloChunkResult } from "../../../types/fallos";
import { FALLOS_COLLECTION_NAME } from "./fallosConfig";

const generateSparseEmbeddings = async (queries: string[]) => {
  const sparseEmbeddings = await fetch("https://api.ialex.com.ar/search/embed", {
    method: "POST",
    headers: {
      "X-API-Key": "HXMjHcjtCVbR6LahFJ1rEemWHbmJbhOhEi7FfbciTec=",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts: queries,
    }),
  });

  if (!sparseEmbeddings.ok) {
    throw new Error(`Sparse embeddings API failed: ${sparseEmbeddings.status} ${sparseEmbeddings.statusText}`);
  }

  return sparseEmbeddings.json();
}

/**
 * Fallos Qdrant search
 **/
export const searchFallos = internalAction({
  args: {
    query: v.optional(v.string()),
    filters: v.optional(v.object({
      jurisdiccion: v.optional(v.string()),
      jurisdiccion_detalle: v.optional(v.string()),
      tribunal: v.optional(v.string()),
      materia: v.optional(v.string()),
      estado: v.optional(v.string()),
      tipo_contenido: v.optional(v.string()),
      tipo_general: v.optional(v.string()),
      sala: v.optional(v.string()),
      document_id: v.optional(v.string()),
      actor: v.optional(v.string()),
      demandado: v.optional(v.string()),
      magistrados: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      // Date filters
      date_from: v.optional(v.string()),
      date_to: v.optional(v.string()),
      sanction_date_from: v.optional(v.string()),
      sanction_date_to: v.optional(v.string()),
      publication_date_from: v.optional(v.string()),
      publication_date_to: v.optional(v.string()),
      // Legacy field mappings for backward compatibility
      fecha_from: v.optional(v.string()),
      fecha_to: v.optional(v.string()),
      promulgacion_from: v.optional(v.string()),
      promulgacion_to: v.optional(v.string()),
      publicacion_from: v.optional(v.string()),
      publicacion_to: v.optional(v.string()),
    })),
    limit: v.optional(v.number()),
    contextWindow: v.optional(v.number()),
  },
  returns: v.array(v.object({
    id: v.string(),
    score: v.number(),
    payload: v.object({
      document_id: v.string(),
      title: v.string(),
      tribunal: v.string(),
      jurisdiccion: v.string(),
      date: v.string(),
      sanction_date: v.string(),
      actor: v.string(),
      demandado: v.string(),
      magistrados: v.string(),
      materia: v.string(),
      tags: v.array(v.string()),
      sumario: v.string(),
      content: v.string(),
      url: v.string(),
      sala: v.string(),
    }),
  })),
  handler: async (ctx, args) => {
    try {
      const { query, filters } = args;
      const limit = args.limit ?? 10;
      const contextWindow = args.contextWindow ?? 0;
      
      console.log('searchFallos called with:', {
        query: query || '(empty)',
        filters: filters || {},
        limit,
        contextWindow
      });
      
      // Skip vector generation if no query is provided (filter-only search)
      const useVectors = query && query.trim().length > 0;
      
      let sparseEmbeddingData;
      let denseEmbeddings;

      if (useVectors) {
        try {
          console.log('Generating sparse embeddings for query:', query);
          const sparseEmbeddings = await generateSparseEmbeddings([query]);

          // Extract the actual embeddings data
          if (Array.isArray(sparseEmbeddings) && sparseEmbeddings.length > 0) {
            sparseEmbeddingData = sparseEmbeddings[0];
          } else if (sparseEmbeddings && typeof sparseEmbeddings === 'object') {
            sparseEmbeddingData = sparseEmbeddings.embeddings || sparseEmbeddings.data || sparseEmbeddings.result || sparseEmbeddings[0];
          } else {
            console.error('Invalid sparse embeddings response:', sparseEmbeddings);
            throw new Error('Unable to extract sparse embeddings from API response');
          }
          console.log('Sparse embeddings generated successfully');
        } catch (sparseError) {
          console.error('Sparse embeddings generation failed:', {
            error: sparseError instanceof Error ? sparseError.message : String(sparseError),
            query
          });
          throw new Error(`Sparse embeddings failed: ${sparseError instanceof Error ? sparseError.message : String(sparseError)}`);
        }

        try {
          console.log('Generating dense embeddings for query:', query);
          denseEmbeddings = await embed({
            model: openai.textEmbeddingModel("text-embedding-3-small"),
            value: query,
          });
          console.log('Dense embeddings generated successfully');
        } catch (denseError) {
          console.error('Dense embeddings generation failed:', {
            error: denseError instanceof Error ? denseError.message : String(denseError),
            query
          });
          throw new Error(`Dense embeddings failed: ${denseError instanceof Error ? denseError.message : String(denseError)}`);
        }
      } else {
        console.log('Skipping vector generation - filter-only search');
      }

      // Check if the collection exists
      try {
        console.log('Checking Qdrant collection existence...');
        const collections = await client.getCollections();
        const hasCollection = collections.collections?.some(c => c.name === FALLOS_COLLECTION_NAME);
        if (!hasCollection) {
          console.error(`Collection "${FALLOS_COLLECTION_NAME}" not found in:`, collections.collections?.map(c => c.name));
          throw new Error(`Collection "${FALLOS_COLLECTION_NAME}" does not exist`);
        }
        console.log('Collection check passed');
      } catch (collectionError) {
        console.error('Collection check failed:', {
          error: collectionError instanceof Error ? collectionError.message : String(collectionError),
          stack: collectionError instanceof Error ? collectionError.stack : undefined
        });
        throw new Error(`Collection validation failed: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
      }

      // Build Qdrant filter
      const must: Array<any> = [];
      
      if (filters) {
        console.log('Building filters from:', filters);
        
        // Direct field filters
        if (filters.jurisdiccion) must.push({ key: 'jurisdiccion', match: { value: filters.jurisdiccion } });
        if (filters.jurisdiccion_detalle) must.push({ key: 'jurisdiccion_detalle', match: { value: filters.jurisdiccion_detalle } });
        if (filters.tribunal) must.push({ key: 'tribunal', match: { value: filters.tribunal } });
        if (filters.materia) must.push({ key: 'materia', match: { value: filters.materia } });
        if (filters.estado) must.push({ key: 'estado', match: { value: filters.estado } });
        if (filters.tipo_contenido) must.push({ key: 'tipo_contenido', match: { value: filters.tipo_contenido } });
        if (filters.tipo_general) must.push({ key: 'tipo_general', match: { value: filters.tipo_general } });
        if (filters.sala) must.push({ key: 'sala', match: { value: filters.sala } });
        if (filters.document_id) must.push({ key: 'document_id', match: { value: filters.document_id } });
        
        // Text search filters (case-insensitive regex)
        if (filters.actor) {
          must.push({ key: 'actor', match: { text: filters.actor } });
        }
        if (filters.demandado) {
          must.push({ key: 'demandado', match: { text: filters.demandado } });
        }
        if (filters.magistrados) {
          must.push({ key: 'magistrados', match: { text: filters.magistrados } });
        }
        
        // Tags filter (array contains)
        if (filters.tags && filters.tags.length > 0) {
          must.push({ key: 'tags', match: { any: filters.tags } });
        }
        
        // Date range filters (using timestamp fields from payload)
        // Date filters with new field names and legacy fallback
        const dateFrom = filters.date_from || filters.fecha_from;
        const dateTo = filters.date_to || filters.fecha_to;
        if (dateFrom || dateTo) {
          const range: any = {};
          if (dateFrom) range.gte = parseInt(dateFrom);
          if (dateTo) range.lte = parseInt(dateTo);
          must.push({ key: 'date_ts', range });
        }

        const sanctionDateFrom = filters.sanction_date_from || filters.promulgacion_from;
        const sanctionDateTo = filters.sanction_date_to || filters.promulgacion_to;
        if (sanctionDateFrom || sanctionDateTo) {
          const range: any = {};
          if (sanctionDateFrom) range.gte = parseInt(sanctionDateFrom);
          if (sanctionDateTo) range.lte = parseInt(sanctionDateTo);
          must.push({ key: 'sanction_ts', range });
        }

        const publicationDateFrom = filters.publication_date_from || filters.publicacion_from;
        const publicationDateTo = filters.publication_date_to || filters.publicacion_to;
        if (publicationDateFrom || publicationDateTo) {
          const range: any = {};
          if (publicationDateFrom) range.gte = parseInt(publicationDateFrom);
          if (publicationDateTo) range.lte = parseInt(publicationDateTo);
          must.push({ key: 'publication_ts', range });
        }
        
        console.log('Built filter conditions:', { must: must.length });
      }

      let points: Array<any> = [];

      // Build final filter object
      const qdrantFilter: any = {};
      if (must.length > 0) {
        qdrantFilter.must = must;
      }
      const hasFilters = must.length > 0;

      if (useVectors && sparseEmbeddingData && denseEmbeddings) {
        // Use hybrid search with vectors
        try {
          console.log('Executing hybrid vector search...');
          console.log('Filter being sent to Qdrant:', JSON.stringify(qdrantFilter, null, 2));
          console.log('Sparse embedding data type:', typeof sparseEmbeddingData, 'keys:', Object.keys(sparseEmbeddingData || {}));
          console.log('Dense embedding length:', denseEmbeddings.embedding?.length);
          
          const searchResults = await client.query(FALLOS_COLLECTION_NAME, {
            prefetch: [
              {
                query: sparseEmbeddingData,
                using: "keywords",
                limit: 50,
              },
              {
                query: denseEmbeddings.embedding,
                using: "dense",
                limit: 50,
              }
            ],
            query: {
              fusion: 'rrf'
            },
            filter: hasFilters ? qdrantFilter : undefined,
            with_payload: true,
          });
          points = searchResults.points || [];
          console.log('Hybrid search completed successfully, points found:', points.length);
        } catch (searchError) {
          console.error('Hybrid search failed:', {
            error: searchError instanceof Error ? searchError.message : String(searchError),
            stack: searchError instanceof Error ? searchError.stack : undefined,
            hasFilters,
            mustCount: must.length,
            filter: JSON.stringify(qdrantFilter, null, 2)
          });
          throw new Error(`Hybrid search failed: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
        }
      } else {
        // Filter-only search using scroll (no vectors needed)
        if (!hasFilters) {
          console.warn('No query and no filters provided - returning empty results');
          points = [];
        } else {
          try {
            console.log('Executing filter-only scroll search...');
            const scrollResults = await client.scroll(FALLOS_COLLECTION_NAME, {
              filter: qdrantFilter,
              with_payload: true,
              with_vector: false,
              limit: Math.min(limit * 3, 100), // Get a bit more to account for clustering
            });
            points = (scrollResults.points || []).map((p: any) => ({
              ...p,
              score: 1.0, // No score for filter-only results
            }));
            console.log('Scroll search completed successfully, points found:', points.length);
          } catch (scrollError) {
            console.error('Scroll search failed:', {
              error: scrollError instanceof Error ? scrollError.message : String(scrollError),
              stack: scrollError instanceof Error ? scrollError.stack : undefined,
              filter: qdrantFilter
            });
            throw new Error(`Scroll search failed: ${scrollError instanceof Error ? scrollError.message : String(scrollError)}`);
          }
        }
      }
      
      console.log('Fallos search results:', { 
        method: useVectors ? 'hybrid-vector' : 'filter-only',
        count: points.length, 
        hasFilters: must.length > 0,
        limit 
      });

      // Group results by document_id (fallback to point id)
      console.log('Grouping results by document_id...');
      const clusters = new Map<string, Array<any>>();
      for (const p of points) {
        const payload = p.payload || {};
        const key = typeof payload.document_id === 'string' && payload.document_id.length > 0
          ? payload.document_id
          : (p.id?.toString() || 'unknown');
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key)!.push(p);
      }
      console.log('Grouped into clusters:', clusters.size);

      // Determine per-document cap to honor overall limit
      const clusterCount = Math.max(1, clusters.size || 1);
      const perDocCap = Math.max(1, Math.floor(limit / clusterCount) || 1);
      console.log('Cluster strategy:', { clusterCount, perDocCap, limit });

      const expandedResults: Array<any> = [];

      // Helper to map a point to the return shape
      const mapPoint = (pt: any, overrides?: { text?: string; index?: number }) => {
        const payload = pt.payload || {};
        const pointId = pt.id?.toString() || 'unknown';
        const text = typeof overrides?.text === 'string' ? overrides!.text : (typeof payload.text === 'string' ? payload.text : undefined);
        const indexVal = typeof overrides?.index === 'number' ? overrides!.index : (typeof payload.index === 'number' ? payload.index : undefined);
        return {
          id: typeof payload.id === 'string' ? payload.id : pointId,
          score: pt.score,
          payload: {
            document_id: typeof payload.document_id === 'string' ? payload.document_id : pointId,
            title: typeof payload.title === 'string' ? payload.title : '',
            tribunal: typeof payload.tribunal === 'string' ? payload.tribunal : '',
            jurisdiccion: typeof payload.jurisdiccion === 'string' ? payload.jurisdiccion : '',
            date: typeof payload.date_ts === 'number' ? payload.date_ts.toString() : '',
            sanction_date: typeof payload.sanction_ts === 'number' ? payload.sanction_ts.toString() : '',
            actor: typeof payload.actor === 'string' ? payload.actor : '',
            demandado: typeof payload.demandado === 'string' ? payload.demandado : '',
            magistrados: typeof payload.magistrados === 'string' ? payload.magistrados : '',
            materia: typeof payload.materia === 'string' ? payload.materia : '',
            tags: Array.isArray(payload.tags) ? payload.tags : [],
            sumario: typeof payload.sumario === 'string' ? payload.sumario : '',
            content: typeof payload.content === 'string' ? payload.content : '',
            url: typeof payload.url === 'string' ? payload.url : '',
            sala: typeof payload.sala === 'string' ? payload.sala : '',
          }
        };
      };

      // Build expanded results with optional context window
      console.log('Building expanded results with contextWindow:', contextWindow);
      for (const [docId, cl] of clusters) {
        if (expandedResults.length >= limit) break;
        // Sort cluster by score desc
        cl.sort((a, b) => (b.score || 0) - (a.score || 0));
        const tops = cl.slice(0, perDocCap);

        for (const top of tops) {
          if (expandedResults.length >= limit) break;
          const payload = top.payload || {};
          const idx: number | undefined = typeof payload.index === 'number' ? payload.index : undefined;

          if (typeof idx === 'number' && contextWindow > 0) {
            const startIndex = Math.max(0, idx - contextWindow);
            const endIndex = idx + contextWindow;
            try {
              console.log('Expanding context for doc:', docId, 'index range:', startIndex, '-', endIndex);
              const range = await client.scroll(FALLOS_COLLECTION_NAME, {
                filter: {
                  must: [
                    { key: 'document_id', match: { value: docId } },
                    { key: 'index', range: { gte: startIndex, lte: endIndex } },
                  ]
                },
                with_payload: true,
                with_vector: false,
                limit: 1000,
              });

              const pointsInRange = (range.points || []).sort((a: any, b: any) => {
                const ai = (a.payload?.index as number) || 0;
                const bi = (b.payload?.index as number) || 0;
                return ai - bi;
              });
              const mergedText = pointsInRange
                .map((p: any) => (p.payload?.text as string) || '')
                .filter((t: string) => t.trim().length > 0)
                .join(' ');

              if (mergedText.length > 0) {
                expandedResults.push(mapPoint(top, { text: mergedText, index: idx }));
              } else {
                const originalText = (payload.text as string) || '';
                if (originalText.trim().length > 0) expandedResults.push(mapPoint(top, { text: originalText, index: idx }));
              }
            } catch (e) {
              console.error('Context expansion failed:', {
                docId,
                index: idx,
                error: e instanceof Error ? e.message : String(e),
                stack: e instanceof Error ? e.stack : undefined
              });
              expandedResults.push(mapPoint(top));
            }
          } else {
            // No expansion requested or missing index
            expandedResults.push(mapPoint(top));
          }
        }
      }

      // If we didn't fill limit due to small cluster sizes, backfill with top global results
      if (expandedResults.length < limit) {
        console.log('Backfilling results, current:', expandedResults.length, 'target:', limit);
        const remaining = limit - expandedResults.length;
        const already = new Set(expandedResults.map(r => `${r.payload.document_id}-${r.payload.index}-${r.id}`));
        const sortedGlobal = [...points].sort((a, b) => (b.score || 0) - (a.score || 0));
        for (const p of sortedGlobal) {
          const key = `${p.payload?.document_id}-${p.payload?.index}-${p.id}`;
          if (already.has(key)) continue;
          expandedResults.push(mapPoint(p));
          if (expandedResults.length >= limit) break;
        }
        console.log('After backfill:', expandedResults.length);
      }

      // Sort final results by score desc and limit
      expandedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      const finalResults = expandedResults.slice(0, limit);
      console.log('Returning fallos results:', { 
        method: useVectors ? 'hybrid-vector' : 'filter-only',
        total: finalResults.length, 
        limit, 
        contextWindow, 
        clusters: clusterCount 
      });
      return finalResults;
    } catch (error) {
      console.error('searchFallos failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: args.query,
        filters: args.filters
      });
      throw new Error(`Fallos search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * Get multiple consecutive chunks by range for a fallo document.
 */
export const getFalloChunksByRange = action({
  args: {
    document_id: v.string(),
    startIndex: v.number(),
    endIndex: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { document_id, startIndex, endIndex } = args;
    try {
      console.log("Fetching fallo chunks by range:", { document_id, startIndex, endIndex });

      // Test connectivity first for clearer errors
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const results = await client.scroll(FALLOS_COLLECTION_NAME, {
        filter: {
          must: [
            { key: 'document_id', match: { value: document_id } },
            { key: 'index', range: { gte: startIndex, lte: endIndex } },
          ]
        },
        with_payload: true,
        with_vector: false,
        limit: 10000,
      });

      console.log("Fallo scroll results:", {
        pointsFound: results.points?.length || 0,
        startIndex,
        endIndex
      });

      const sorted = (results.points || []).sort((a: any, b: any) => {
        const ai = (a.payload?.index as number) || 0;
        const bi = (b.payload?.index as number) || 0;
        return ai - bi;
      });

      const texts = sorted.map((p: any) => {
        const t = p.payload?.text;
        if (typeof t !== 'string') return '';
        return t;
      }).filter((t: string) => t.length > 0);

      console.log("Successfully retrieved fallo chunks:", {
        startIndex,
        endIndex,
        chunksRetrieved: texts.length,
        totalTextLength: texts.reduce((sum, t) => sum + t.length, 0)
      });

      return texts;
    } catch (error) {
      console.error("Error fetching fallo chunks by range:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch fallo chunks: ${errorMessage}`);
    }
  }
});

/**
 * Get total chunk count for a fallo document.
 */
export const getFalloChunkCount = action({
  args: {
    document_id: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { document_id } = args;
    await client.getCollections();

    const results = await client.scroll(FALLOS_COLLECTION_NAME, {
      filter: {
        must: [
          { key: 'document_id', match: { value: document_id } },
        ]
      },
      with_payload: false,
      with_vector: false,
      limit: 10000,
    });

    return results.points?.length || 0;
  }
});
