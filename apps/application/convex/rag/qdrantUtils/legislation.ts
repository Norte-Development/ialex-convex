'use node'

import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { client } from "./client";
import { LegislationSearchResult } from "./types";

/**
 * Legislation Qdrant search
 **/
export const searchNormatives = internalAction({
  args: {
    query: v.string(),
  },
  returns: v.array(v.object({
    id: v.string(), // Always present - either from payload or point ID
    country_code: v.optional(v.string()),
    document_id: v.optional(v.string()),
    fuente: v.optional(v.string()),
    relaciones: v.array(v.string()),
    title: v.optional(v.string()),
    index: v.optional(v.number()),
    tipo_norma: v.optional(v.string()),
    citas: v.array(v.string()),
    publication_ts: v.optional(v.number()),
    text: v.optional(v.string()),
    type: v.optional(v.string()),
    url: v.optional(v.string()),
    last_ingested_run_id: v.optional(v.string()),
    number: v.optional(v.string()),
    date_ts: v.optional(v.number()),
    content_hash: v.optional(v.string()),
    tipo_organismo: v.optional(v.string()),
    jurisdiccion: v.optional(v.string()),
    tipo_contenido: v.optional(v.string()),
    sanction_ts: v.optional(v.number()),
    tags: v.array(v.string()),
    estado: v.optional(v.string()),
    score: v.number(),
  })),
  handler: async (ctx, args) => {
    const { query } = args;

    const sparseEmbeddingsResponse = await fetch("https://api.ialex.com.ar/search/embed", {
      headers: {
        "X-API-Key": "HXMjHcjtCVbR6LahFJ1rEemWHbmJbhOhEi7FfbciTec=",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: [query],
      }),
      method: "POST",
    });

    const sparseEmbeddings = await sparseEmbeddingsResponse.json();

    console.log('Sparse embeddings response:', sparseEmbeddings);
    console.log('Sparse embeddings type:', typeof sparseEmbeddings);
    console.log('Sparse embeddings keys:', Object.keys(sparseEmbeddings));

    // Check if sparse embeddings API returned an error
    if (!sparseEmbeddingsResponse.ok) {
      throw new Error(`Sparse embeddings API failed: ${sparseEmbeddingsResponse.status} ${sparseEmbeddingsResponse.statusText}`);
    }

    // Extract the actual embeddings data - this might need adjustment based on the API response structure
    let sparseEmbeddingData;
    if (Array.isArray(sparseEmbeddings) && sparseEmbeddings.length > 0) {
      sparseEmbeddingData = sparseEmbeddings[0];
    } else if (sparseEmbeddings && typeof sparseEmbeddings === 'object') {
      // If it's an object, try to find the embeddings in common property names
      sparseEmbeddingData = sparseEmbeddings.embeddings || sparseEmbeddings.data || sparseEmbeddings.result || sparseEmbeddings[0];
    } else {
      throw new Error('Unable to extract sparse embeddings from API response');
    }

    console.log('Extracted sparse embedding data:', sparseEmbeddingData);

    const denseEmbeddings = await embed({
      model: openai.textEmbeddingModel("text-embedding-3-small"),
      value: query,
    });

    console.log('Dense embeddings:', {
      embedding: denseEmbeddings.embedding,
      length: denseEmbeddings.embedding.length
    });

    // Check if the collection exists
    try {
      const collections = await client.getCollections();
      console.log('Available collections:', collections.collections?.map(c => c.name));
      const hasCollection = collections.collections?.some(c => c.name === 'ialex_legislation_py');
      if (!hasCollection) {
        throw new Error('Collection "ialex_legislation_py" does not exist');
      }
    } catch (collectionError) {
      console.error('Collection check failed:', collectionError);
      throw new Error(`Collection validation failed: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
    }

    console.log('Querying Qdrant with:', {
      collection: 'ialex_legislation_py',
      sparseEmbeddingType: typeof sparseEmbeddingData,
      denseEmbeddingLength: denseEmbeddings.embedding.length
    });

    const searchResults = await client.query('ialex_legislation_py', {
      prefetch: [
        {
          query: sparseEmbeddingData,
          using: "keywords",
          limit: 50,
        },
        {
          query: denseEmbeddings.embedding, // Use .embedding property
          using: "dense",
          limit: 50,
        }
      ],
      query: {
        fusion: 'rrf'
      },
      with_payload: true,
    });

    console.log('Search results:', searchResults);

    // Debug what payload fields are actually returned
    if (searchResults.points && searchResults.points.length > 0) {
      console.log('First result payload keys:', Object.keys(searchResults.points[0].payload || {}));
      console.log('First result payload:', searchResults.points[0].payload);
    }

    const results = searchResults.points;


    return results.map(result => {
      const payload = result.payload || {};

      // Use point ID as fallback if payload doesn't have id
      const pointId = result.id?.toString() || 'unknown';

      return {
        id: typeof payload.id === 'string' ? payload.id : pointId, // Always a string
        country_code: typeof payload.country_code === 'string' ? payload.country_code : undefined,
        document_id: typeof payload.document_id === 'string' ? payload.document_id : undefined,
        fuente: typeof payload.fuente === 'string' ? payload.fuente : undefined,
        relaciones: Array.isArray(payload.relaciones) ? payload.relaciones : [],
        title: typeof payload.title === 'string' ? payload.title : undefined,
        index: typeof payload.index === 'number' ? payload.index : undefined,
        tipo_norma: typeof payload.tipo_norma === 'string' ? payload.tipo_norma : undefined,
        citas: Array.isArray(payload.citas) ? payload.citas : [],
        publication_ts: typeof payload.publication_ts === 'number' ? payload.publication_ts : undefined,
        text: typeof payload.text === 'string' ? payload.text : undefined,
        type: typeof payload.type === 'string' ? payload.type : undefined,
        url: typeof payload.url === 'string' ? payload.url : undefined,
        last_ingested_run_id: typeof payload.last_ingested_run_id === 'string' ? payload.last_ingested_run_id : undefined,
        number: typeof payload.number === 'string' ? payload.number : undefined,
        date_ts: typeof payload.date_ts === 'number' ? payload.date_ts : undefined,
        content_hash: typeof payload.content_hash === 'string' ? payload.content_hash : undefined,
        tipo_organismo: typeof payload.tipo_organismo === 'string' ? payload.tipo_organismo : undefined,
        jurisdiccion: typeof payload.jurisdiccion === 'string' ? payload.jurisdiccion : undefined,
        tipo_contenido: typeof payload.tipo_contenido === 'string' ? payload.tipo_contenido : undefined,
        sanction_ts: typeof payload.sanction_ts === 'number' ? payload.sanction_ts : undefined,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        estado: typeof payload.estado === 'string' ? payload.estado : undefined,
        score: result.score,
      };
    });
  }
});
