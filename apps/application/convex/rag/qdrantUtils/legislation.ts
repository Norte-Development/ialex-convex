'use node'

import { action, internalAction, query } from "../../_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { client } from "./client";
import { LegislationSearchResult } from "./types";
import { LEGISLATION_COLLECTION_NAME } from "./legislationConfig";

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
 * Legislation Qdrant search
 **/
export const searchNormatives = internalAction({
  args: {
    query: v.optional(v.string()),
    filters: v.optional(v.object({
      jurisdiccion: v.optional(v.string()),
      tipo_norma: v.optional(v.string()),
      tipo_general: v.optional(v.string()),
      estado: v.optional(v.string()),
      subestado: v.optional(v.string()),
      tipo_contenido: v.optional(v.string()),
      country_code: v.optional(v.string()),
      document_id: v.optional(v.string()),
      fuente: v.optional(v.string()),
      number: v.optional(v.union(v.string(), v.number() as any)),
      // Timestamp filters (backward compatibility)
      publication_ts_from: v.optional(v.number()),
      publication_ts_to: v.optional(v.number()),
      sanction_ts_from: v.optional(v.number()),
      sanction_ts_to: v.optional(v.number()),
      // Date string filters (will be converted to timestamps)
      publication_date_from: v.optional(v.string()),
      publication_date_to: v.optional(v.string()),
      sanction_date_from: v.optional(v.string()),
      sanction_date_to: v.optional(v.string()),
    })),
    limit: v.optional(v.number()),
    contextWindow: v.optional(v.number()),
  },
  returns: v.array(v.object({
    id: v.string(), // Always present - either from payload or point ID
    content_hash: v.optional(v.string()),
    date_ts: v.optional(v.number()),
    fuente: v.optional(v.string()),
    tipo_contenido: v.optional(v.string()),
    publication_ts: v.optional(v.number()),
    text: v.optional(v.string()),
    tags: v.array(v.union(v.string(), v.any())),
    country_code: v.optional(v.string()),
    title: v.optional(v.string()),
    estado: v.optional(v.string()),
    subestado: v.optional(v.string()),
    tipo_general: v.optional(v.string()),
    citas: v.array(v.union(v.string(), v.any())),
    tipo_detalle: v.optional(v.string()),
    index: v.optional(v.number()),
    last_ingested_run_id: v.optional(v.string()),
    relaciones: v.array(v.union(v.string(), v.any())),
    jurisdiccion: v.optional(v.string()),
    number: v.optional(v.string()),
    document_id: v.optional(v.string()),
    url: v.optional(v.string()),
    sanction_ts: v.optional(v.number()),
    // Legacy fields for backward compatibility
    tipo_norma: v.optional(v.string()),
    type: v.optional(v.string()),
    tipo_organismo: v.optional(v.string()),
    score: v.number(),
  })),
  handler: async (ctx, args) => {
    try {
      const { query, filters } = args;
      const limit = args.limit ?? 10;
      const contextWindow = args.contextWindow ?? 0;
      
      console.log('searchNormatives called with:', {
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

          // Extract the actual embeddings data - this might need adjustment based on the API response structure
          if (Array.isArray(sparseEmbeddings) && sparseEmbeddings.length > 0) {
            sparseEmbeddingData = sparseEmbeddings[0];
          } else if (sparseEmbeddings && typeof sparseEmbeddings === 'object') {
            // If it's an object, try to find the embeddings in common property names
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
        const hasCollection = collections.collections?.some(c => c.name === LEGISLATION_COLLECTION_NAME);
        if (!hasCollection) {
          console.error(`Collection "${LEGISLATION_COLLECTION_NAME}" not found in:`, collections.collections?.map(c => c.name));
          throw new Error(`Collection "${LEGISLATION_COLLECTION_NAME}" does not exist`);
        }
        console.log('Collection check passed');
      } catch (collectionError) {
        console.error('Collection check failed:', {
          error: collectionError instanceof Error ? collectionError.message : String(collectionError),
          stack: collectionError instanceof Error ? collectionError.stack : undefined
        });
        throw new Error(`Collection validation failed: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
      }


      // Build Qdrant filter (MongoDB-compatible)
      const must: Array<any> = [];
      const should: Array<any> = [];
      
      if (filters) {
        console.log('Building filters from:', filters);
        
        // Direct field filters
        if (filters.jurisdiccion) must.push({ key: 'jurisdiccion', match: { value: filters.jurisdiccion } });
        if (filters.tipo_general) must.push({ key: 'tipo_general', match: { value: filters.tipo_general } });
        if (filters.estado) must.push({ key: 'estado', match: { value: filters.estado } });
        if (filters.subestado) must.push({ key: 'subestado', match: { value: filters.subestado } });
        if (filters.tipo_contenido) must.push({ key: 'tipo_contenido', match: { value: filters.tipo_contenido } });
        if (filters.country_code) must.push({ key: 'country_code', match: { value: filters.country_code } });
        if (filters.document_id) must.push({ key: 'document_id', match: { value: filters.document_id } });
        if (filters.fuente) must.push({ key: 'fuente', match: { value: filters.fuente } });
        
        // Map tipo_norma to tipo_general for backward compatibility
        if (filters.tipo_norma) {
          must.push({ key: 'tipo_general', match: { value: filters.tipo_norma } });
        }
        
        // OR logic for number (search both number and numero fields)
        if (filters.number) {
          const numberStr = String(filters.number);
          should.push(
            { key: 'number', match: { value: numberStr } },
            { key: 'numero', match: { value: numberStr } }
          );
        }
        
        // Date range filters - convert date strings to timestamps
        // Sanction date range
        const sanctionTsFrom = filters.sanction_date_from 
          ? Math.floor(new Date(filters.sanction_date_from).getTime() / 1000)
          : filters.sanction_ts_from;
        const sanctionTsTo = filters.sanction_date_to
          ? Math.floor(new Date(filters.sanction_date_to).getTime() / 1000)
          : filters.sanction_ts_to;
        
        if (sanctionTsFrom || sanctionTsTo) {
          const range: any = {};
          if (sanctionTsFrom) range.gte = sanctionTsFrom;
          if (sanctionTsTo) range.lte = sanctionTsTo;
          must.push({ key: 'sanction_ts', range });
        }
        
        // Publication date range
        const publicationTsFrom = filters.publication_date_from
          ? Math.floor(new Date(filters.publication_date_from).getTime() / 1000)
          : filters.publication_ts_from;
        const publicationTsTo = filters.publication_date_to
          ? Math.floor(new Date(filters.publication_date_to).getTime() / 1000)
          : filters.publication_ts_to;
        
        if (publicationTsFrom || publicationTsTo) {
          const range: any = {};
          if (publicationTsFrom) range.gte = publicationTsFrom;
          if (publicationTsTo) range.lte = publicationTsTo;
          must.push({ key: 'publication_ts', range });
        }
        
        console.log('Built filter conditions:', { must: must.length, should: should.length });
      }

      let points: Array<any> = [];

      // Build final filter object
      const qdrantFilter: any = {};
      if (must.length > 0) qdrantFilter.must = must;
      if (should.length > 0) {
        qdrantFilter.should = should;
        qdrantFilter.min_should_match = 1;
      }
      const hasFilters = must.length > 0 || should.length > 0;

      if (useVectors && sparseEmbeddingData && denseEmbeddings) {
        // Use hybrid search with vectors
        try {
          console.log('Executing hybrid vector search...');
          const searchResults = await client.query(LEGISLATION_COLLECTION_NAME, {
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
            shouldCount: should.length
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
            const scrollResults = await client.scroll(LEGISLATION_COLLECTION_NAME, {
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
      console.log('Legislation search results:', { 
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

      // Helper to map a point to the return shape, allowing text/index overrides
      const mapPoint = (pt: any, overrides?: { text?: string; index?: number }) => {
        const payload = pt.payload || {};
        const pointId = pt.id?.toString() || 'unknown';
        const text = typeof overrides?.text === 'string' ? overrides!.text : (typeof payload.text === 'string' ? payload.text : undefined);
        const indexVal = typeof overrides?.index === 'number' ? overrides!.index : (typeof payload.index === 'number' ? payload.index : undefined);
        return {
          id: typeof payload.id === 'string' ? payload.id : pointId,
          content_hash: typeof payload.content_hash === 'string' ? payload.content_hash : undefined,
          date_ts: typeof payload.date_ts === 'number' ? payload.date_ts : undefined,
          fuente: typeof payload.fuente === 'string' ? payload.fuente : undefined,
          tipo_contenido: typeof payload.tipo_contenido === 'string' ? payload.tipo_contenido : undefined,
          publication_ts: typeof payload.publication_ts === 'number' ? payload.publication_ts : undefined,
          text,
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          country_code: typeof payload.country_code === 'string' ? payload.country_code : undefined,
          title: typeof payload.title === 'string' ? payload.title : undefined,
          estado: typeof payload.estado === 'string' ? payload.estado : undefined,
          subestado: typeof payload.subestado === 'string' ? payload.subestado : undefined,
          tipo_general: typeof payload.tipo_general === 'string' ? payload.tipo_general : undefined,
          citas: Array.isArray(payload.citas) ? payload.citas : [],
          tipo_detalle: typeof payload.tipo_detalle === 'string' ? payload.tipo_detalle : undefined,
          index: indexVal,
          last_ingested_run_id: typeof payload.last_ingested_run_id === 'string' ? payload.last_ingested_run_id : undefined,
          relaciones: Array.isArray(payload.relaciones) ? payload.relaciones : [],
          jurisdiccion: typeof payload.jurisdiccion === 'string' ? payload.jurisdiccion : undefined,
          number: typeof payload.number === 'string' ? payload.number : undefined,
          document_id: typeof payload.document_id === 'string' ? payload.document_id : undefined,
          url: typeof payload.url === 'string' ? payload.url : undefined,
          sanction_ts: typeof payload.sanction_ts === 'number' ? payload.sanction_ts : undefined,
          // Legacy fields for backward compatibility
          tipo_norma: typeof payload.tipo_norma === 'string' ? payload.tipo_norma : undefined,
          type: typeof payload.type === 'string' ? payload.type : undefined,
          tipo_organismo: typeof payload.tipo_organismo === 'string' ? payload.tipo_organismo : undefined,
          score: pt.score,
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
              const range = await client.scroll(LEGISLATION_COLLECTION_NAME, {
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
        const already = new Set(expandedResults.map(r => `${r.document_id}-${r.index}-${r.id}`));
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
      console.log('Returning legislation results:', { 
        method: useVectors ? 'hybrid-vector' : 'filter-only',
        total: finalResults.length, 
        limit, 
        contextWindow, 
        clusters: clusterCount 
      });
      return finalResults;
    } catch (error) {
      console.error('searchNormatives failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: args.query,
        filters: args.filters
      });
      throw new Error(`Legislation search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

/**
 * Search within a specific legislation document for relevant chunks.
 */
export const searchDocumentChunks = action({
  args: {
    document_id: v.string(),
    query: v.string(),
    limit: v.number(),
    contextWindow: v.optional(v.number()),
  },
  returns: v.array(v.object({
    index: v.number(),
    text: v.string(),
    score: v.number(),
    expanded: v.optional(v.boolean()),
  })),
  handler: async (ctx, args) => {
    const { document_id, query, limit, contextWindow } = args;

    // Ensure connectivity
    await client.getCollections();

    const vector = await embed({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      value: query,
    });

    // Search within specific document
    const results = await client.search(LEGISLATION_COLLECTION_NAME, {
      vector: vector.embedding,
      limit,
      filter: {
        must: [
          { key: 'document_id', match: { value: document_id } },
        ]
      }
    });

    // Sort by score high to low
    results.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    // If contextWindow requested, expand around top results
    const top = results.slice(0, limit);
    if (contextWindow && contextWindow > 0) {
      const expanded: Array<{ index: number; text: string; score: number; expanded?: boolean }> = [];
      for (const r of top) {
        const idx = (r.payload?.index as number) ?? 0;
        const startIndex = Math.max(0, idx - contextWindow);
        const endIndex = idx + contextWindow;

        const range = await client.scroll(LEGISLATION_COLLECTION_NAME, {
          filter: {
            must: [
              { key: 'document_id', match: { value: document_id } },
              { key: 'index', range: { gte: startIndex, lte: endIndex } },
            ]
          },
          with_payload: true,
          with_vector: false,
          limit: 1000,
        });

        const points = (range.points || []).sort((a: any, b: any) => {
          const ai = (a.payload?.index as number) || 0;
          const bi = (b.payload?.index as number) || 0;
          return ai - bi;
        });
        const mergedText = points.map((p: any) => (p.payload?.text as string) || '').filter((t: string) => t.trim().length > 0).join(' ');
        if (mergedText.length > 0) {
          expanded.push({ index: idx, text: mergedText, score: r.score || 0, expanded: true });
        } else {
          const text = (r.payload?.text as string) || '';
          if (text.trim().length > 0) expanded.push({ index: idx, text, score: r.score || 0 });
        }
      }
      return expanded;
    }

    // No expansion: return simple results
    return top.map((r: any) => ({
      index: (r.payload?.index as number) || 0,
      text: (r.payload?.text as string) || '',
      score: r.score || 0,
    })).filter((r) => r.text.length > 0);
  }
});

/**
 * Get multiple consecutive chunks by range for a legislation document.
 */
export const getDocumentChunksByRange = action({
  args: {
    document_id: v.string(),
    startIndex: v.number(),
    endIndex: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { document_id, startIndex, endIndex } = args;
    try {
      console.log("Fetching legislation chunks by range:", { document_id, startIndex, endIndex });

      // Test connectivity first for clearer errors
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const results = await client.scroll(LEGISLATION_COLLECTION_NAME, {
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

      console.log("Legislation scroll results:", {
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

      console.log("Successfully retrieved legislation chunks:", {
        startIndex,
        endIndex,
        chunksRetrieved: texts.length,
        totalTextLength: texts.reduce((sum, t) => sum + t.length, 0)
      });

      return texts;
    } catch (error) {
      console.error("Error fetching legislation chunks by range:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch legislation chunks: ${errorMessage}`);
    }
  }
});

/**
 * Get total chunk count for a legislation document.
 */
export const getDocumentChunkCount = action({
  args: {
    document_id: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { document_id } = args;
    await client.getCollections();

    const results = await client.scroll(LEGISLATION_COLLECTION_NAME, {
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
