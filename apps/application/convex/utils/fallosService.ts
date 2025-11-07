'use node'

import { MongoClient, Filter, Sort, Document, ObjectId } from 'mongodb';
import { FalloDoc, FalloFilters, ListFallosParams, FalloSortBy, FalloSortOrder, PaginatedResult } from '../../types/fallos';
import { FALLOS_COLLECTION_NAME } from '../rag/qdrantUtils/fallosConfig';

// External service clients - lazy initialization
let mongoClient: MongoClient | null = null;

// Helper function to ensure MongoDB client is connected
const ensureMongoClient = async (): Promise<MongoClient> => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Create new client if needed
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      // Connection pool options for serverless environments
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  return mongoClient;
};

// Lazy getter for MongoDB client (for backward compatibility)
const getMongoClient = (): MongoClient => {
  if (!mongoClient) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }
  return mongoClient;
};

// Helper function to execute MongoDB operations with retry logic
const withMongoRetry = async <T>(
  operation: (client: MongoClient) => Promise<T>,
  retries = 1
): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = await ensureMongoClient();
      return await operation(client);
    } catch (error: any) {
      const isTopologyClosed = 
        error?.message?.includes('Topology is closed') ||
        error?.message?.includes('topology was destroyed') ||
        error?.code === 'MongoTopologyClosed';

      if (isTopologyClosed && attempt < retries) {
        console.log(`MongoDB topology closed, retrying (attempt ${attempt + 1}/${retries + 1})...`);
        // Reset client to force reconnection
        if (mongoClient) {
          try {
            await mongoClient.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
        mongoClient = null;
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Operation failed after retries');
};

// Cache for tipo_general enum values
interface TipoGeneralCache {
  values: string[];
  timestamp: number;
}

let tipoGeneralCache: TipoGeneralCache | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get distinct tipo_general values with caching
export const getTipoGeneralValues = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached values if still valid
  if (tipoGeneralCache && (now - tipoGeneralCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Returning cached tipo_general values for fallos');
    return tipoGeneralCache.values;
  }
  
  try {
    console.log('Fetching distinct tipo_general values from MongoDB for fallos...');
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);
      return await collection.distinct('tipo_general', {
        tipo_general: { $exists: true, $ne: null }
      });
    });
    
    // Filter out null/undefined and sort
    const validValues = distinctValues
      .filter((val): val is string => typeof val === 'string' && val.length > 0)
      .sort();
    
    // Update cache
    tipoGeneralCache = {
      values: validValues,
      timestamp: now
    };
    
    console.log(`Cached ${validValues.length} tipo_general values for fallos:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching tipo_general values for fallos:', error);
    // Return cached values if available, even if expired
    if (tipoGeneralCache) {
      console.warn('Using expired cache due to error');
      return tipoGeneralCache.values;
    }
    throw new Error('Failed to fetch tipo_general values for fallos');
  }
};

// Cache for jurisdiccion enum values
interface JurisdiccionCache {
  values: string[];
  timestamp: number;
}

let jurisdiccionCache: JurisdiccionCache | null = null;

// Cache for tribunal enum values
interface TribunalCache {
  values: string[];
  timestamp: number;
}

let tribunalCache: TribunalCache | null = null;

// Cache clearing function
export const clearFallosCache = () => {
  tipoGeneralCache = null;
  jurisdiccionCache = null;
  tribunalCache = null;
  console.log('Fallos cache cleared');
};

// Get distinct jurisdiccion values with caching
export const getJurisdiccionValues = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached values if still valid
  if (jurisdiccionCache && (now - jurisdiccionCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Returning cached jurisdiccion values for fallos');
    return jurisdiccionCache.values;
  }
  
  try {
    console.log('Fetching distinct jurisdiccion values from MongoDB for fallos...');
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);
      return await collection.distinct('jurisdiccion', {
        jurisdiccion: { $exists: true, $ne: null }
      });
    });
    
    // Filter out null/undefined and sort
    const validValues = distinctValues
      .filter((val): val is string => typeof val === 'string' && val.length > 0)
      .sort();
    
    // Update cache
    jurisdiccionCache = {
      values: validValues,
      timestamp: now
    };
    
    console.log(`Cached ${validValues.length} jurisdiccion values for fallos:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching jurisdiccion values for fallos:', error);
    // Return cached values if available, even if expired
    if (jurisdiccionCache) {
      console.warn('Using expired cache due to error');
      return jurisdiccionCache.values;
    }
    throw new Error('Failed to fetch jurisdiccion values for fallos');
  }
};

// Get distinct tribunal values with caching
export const getTribunalValues = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached values if still valid
  if (tribunalCache && (now - tribunalCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Returning cached tribunal values for fallos');
    return tribunalCache.values;
  }
  
  try {
    console.log('Fetching distinct tribunal values from MongoDB for fallos...');
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);
      return await collection.distinct('tribunal', {
        tribunal: { $exists: true, $ne: null }
      });
    });
    
    // Filter out null/undefined and sort
    const validValues = distinctValues
      .filter((val): val is string => typeof val === 'string' && val.length > 0)
      .sort();
    
    // Update cache
    tribunalCache = {
      values: validValues,
      timestamp: now
    };
    
    console.log(`Cached ${validValues.length} tribunal values for fallos:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching tribunal values for fallos:', error);
    // Return cached values if available, even if expired
    if (tribunalCache) {
      console.warn('Using expired cache due to error');
      return tribunalCache.values;
    }
    throw new Error('Failed to fetch tribunal values for fallos');
  }
};

// Build MongoDB filter from filters object
const buildMongoFilter = (filters: FalloFilters): Filter<Document> => {
  const mongoFilter: Filter<Document> = {};
  const andConditions: any[] = [];

  // Jurisdiccion filter
  if (filters.jurisdiccion) {
    mongoFilter.jurisdiccion = filters.jurisdiccion;
  }

  // Tribunal filter
  if (filters.tribunal) {
    mongoFilter.tribunal = filters.tribunal;
  }

  // Materia filter
  if (filters.materia) {
    mongoFilter.materia = filters.materia;
  }

  // Estado filter
  if (filters.estado) {
    mongoFilter.estado = filters.estado;
  }

  // Tipo contenido filter
  if (filters.tipo_contenido) {
    mongoFilter.tipo_contenido = filters.tipo_contenido;
  }

  // Tipo general filter
  if (filters.tipo_general) {
    mongoFilter.tipo_general = filters.tipo_general;
  }

  // Sala filter
  if (filters.sala) {
    mongoFilter.sala = filters.sala;
  }

  // Document ID filter
  if (filters.document_id) {
    mongoFilter.document_id = filters.document_id;
  }

  // New field filters
  if (filters.country_code) {
    mongoFilter.country_code = filters.country_code;
  }

  if (filters.fuente) {
    mongoFilter.fuente = filters.fuente;
  }

  if (filters.subestado) {
    mongoFilter.subestado = filters.subestado;
  }

  if (filters.tipo_detalle) {
    mongoFilter.tipo_detalle = filters.tipo_detalle;
  }

  // Date range filters - using new field names with legacy fallback
  const dateFrom = filters.date_from || filters.fecha_from;
  const dateTo = filters.date_to || filters.fecha_to;
  if (dateFrom || dateTo) {
    mongoFilter.date = {};
    if (dateFrom) {
      mongoFilter.date.$gte = dateFrom;
    }
    if (dateTo) {
      mongoFilter.date.$lte = dateTo;
    }
  }

  const sanctionDateFrom = filters.sanction_date_from || filters.promulgacion_from;
  const sanctionDateTo = filters.sanction_date_to || filters.promulgacion_to;
  if (sanctionDateFrom || sanctionDateTo) {
    mongoFilter.sanction_date = {};
    if (sanctionDateFrom) {
      mongoFilter.sanction_date.$gte = sanctionDateFrom;
    }
    if (sanctionDateTo) {
      mongoFilter.sanction_date.$lte = sanctionDateTo;
    }
  }

  const publicationDateFrom = filters.publication_date_from || filters.publicacion_from;
  const publicationDateTo = filters.publication_date_to || filters.publicacion_to;
  if (publicationDateFrom || publicationDateTo) {
    mongoFilter.publication_date = {};
    if (publicationDateFrom) {
      mongoFilter.publication_date.$gte = publicationDateFrom;
    }
    if (publicationDateTo) {
      mongoFilter.publication_date.$lte = publicationDateTo;
    }
  }

  // Text search filters (case-insensitive regex)
  if (filters.actor) {
    andConditions.push({
      actor: { $regex: filters.actor, $options: 'i' }
    });
  }

  if (filters.demandado) {
    andConditions.push({
      demandado: { $regex: filters.demandado, $options: 'i' }
    });
  }

  if (filters.magistrados) {
    andConditions.push({
      magistrados: { $regex: filters.magistrados, $options: 'i' }
    });
  }

  // Tags filter (array contains)
  if (filters.tags && filters.tags.length > 0) {
    mongoFilter.tags = { $in: filters.tags };
  }

  // Text search in title, content, and materia - using new field names
  if (filters.search) {
    andConditions.push({
      $or: [
        { title: { $regex: filters.search, $options: 'i' } },
        { content: { $regex: filters.search, $options: 'i' } },
        { materia: { $regex: filters.search, $options: 'i' } }
      ]
    });
  }

  // Add $and conditions if any exist
  if (andConditions.length > 0) {
    mongoFilter.$and = andConditions;
  }

  return mongoFilter;
};

// Build MongoDB sort from sort parameters
const buildMongoSort = (sortBy?: FalloSortBy, sortOrder: FalloSortOrder = 'desc'): Sort => {
  const order = sortOrder === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'date':
    case 'fecha': // Legacy Spanish field name
      return { date: order, _id: -1 };
    case 'sanction_date':
    case 'promulgacion': // Legacy Spanish field name
      return { sanction_date: order, _id: -1 };
    case 'publication_date':
    case 'publicacion': // Legacy Spanish field name
      return { publication_date: order, _id: -1 };
    case 'indexed_at':
      return { indexed_at: order, _id: -1 };
    case 'created_at':
      return { created_at: order, _id: -1 };
    case 'updated_at':
      return { updated_at: order, _id: -1 };
    case 'relevancia':
      return { _id: -1 }; // For search results, just sort by _id
    default:
      // Default sort by date with _id as secondary sort
      return { date: order, _id: -1 };
  }
};

export const getFallos = async (params: ListFallosParams = {}): Promise<PaginatedResult<FalloDoc>> => {
  const {
    filters = {},
    limit = 20,
    offset = 0,
    sortBy,
    sortOrder = 'desc'
  } = params;

  // Validate limit to prevent excessive data retrieval
  const validatedLimit = Math.min(Math.max(1, limit), 100);
  const validatedOffset = Math.max(0, offset);

  // Build MongoDB filter and sort
  const mongoFilter = buildMongoFilter(filters);
  const mongoSort = buildMongoSort(sortBy, sortOrder);

  console.log('MongoDB filter for fallos:', JSON.stringify(mongoFilter, null, 2));
  console.log('MongoDB sort for fallos:', mongoSort);

  try {
    // Execute query with retry logic
    const { total, fallos } = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);

      // Get total count for pagination
      const total = await collection.countDocuments(mongoFilter);

      // Get paginated results with limited fields (exclude large content fields)
      const fallos = await collection
        .find(mongoFilter)
        .project({
          // Exclude large content fields to improve performance
          content: 0,
          relaciones: 0,
          created_at: 0,
          updated_at: 0
        })
        .sort(mongoSort)
        .skip(validatedOffset)
        .limit(validatedLimit)
        .toArray();

      return { total, fallos };
    });

    // Map fallos to ensure consistent data structure
    const mappedFallos: FalloDoc[] = fallos.map((fallo) => ({
      _id: fallo._id.toString(),
      document_id: fallo.document_id,
      actor: fallo.actor,
      autor: fallo.autor || '',
      citas: fallo.citas || [],
      content: '', // Empty string since content is excluded in projection
      content_hash: fallo.content_hash || '',
      country_code: fallo.country_code || '',
      date: fallo.date,
      date_source: fallo.date_source || '',
      demandado: fallo.demandado,
      estado: fallo.estado,
      fuente: fallo.fuente || '',
      indexed_at: fallo.indexed_at || '',
      jurisdiccion: fallo.jurisdiccion,
      jurisdiccion_detalle: fallo.jurisdiccion_detalle || null,
      last_ingested_run_id: fallo.last_ingested_run_id || '',
      magistrados: fallo.magistrados || '',
      materia: fallo.materia,
      number: fallo.number || '',
      objeto: fallo.objeto || null,
      observaciones: fallo.observaciones || null,
      organismo_emisor: fallo.organismo_emisor || null,
      publication_date: fallo.publication_date,
      referencias_bibliograficas: fallo.referencias_bibliograficas || [],
      referencias_jurisprudenciales: fallo.referencias_jurisprudenciales || [],
      referencias_normativas: fallo.referencias_normativas || [],
      relaciones_salientes: fallo.relaciones_salientes || [],
      sala: fallo.sala,
      sanction_date: fallo.sanction_date,
      sigla_emisor: fallo.sigla_emisor || null,
      subestado: fallo.subestado || '',
      sumario: fallo.sumario,
      sumario_extendido: fallo.sumario_extendido || '',
      tags: fallo.tags || [],
      tipo_contenido: fallo.tipo_contenido,
      tipo_detalle: fallo.tipo_detalle || '',
      tipo_general: fallo.tipo_general,
      title: fallo.title,
      tribunal: fallo.tribunal,
      url: fallo.url || '',
      relaciones: fallo.relaciones || []
    }));

    // Calculate pagination info
    const page = Math.floor(validatedOffset / validatedLimit) + 1;
    const totalPages = Math.ceil(total / validatedLimit);

    return {
      items: mappedFallos,
      pagination: {
        page,
        limit: validatedLimit,
        total,
        totalPages,
        hasNext: validatedOffset + validatedLimit < total,
        hasPrev: validatedOffset > 0
      }
    };
  } catch (error) {
    console.error('Error fetching fallos:', error);
    throw new Error('Failed to fetch fallos');
  }
};

// Get a single fallo by document_id (with full content)
export const getFalloById = async (documentId: string): Promise<FalloDoc | null> => {
  try {
    // Create query filter
    const queryFilter = { document_id: documentId };

    // Get full document including content
    const fallo = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);
      return await collection.findOne(queryFilter);
    });

    if (!fallo) {
      return null;
    }

    return {
      _id: fallo._id.toString(),
      document_id: fallo.document_id,
      actor: fallo.actor,
      autor: fallo.autor || '',
      citas: fallo.citas || [],
      content: fallo.content,
      content_hash: fallo.content_hash || '',
      country_code: fallo.country_code || '',
      date: fallo.date,
      date_source: fallo.date_source || '',
      demandado: fallo.demandado,
      estado: fallo.estado,
      fuente: fallo.fuente || '',
      indexed_at: fallo.indexed_at || '',
      jurisdiccion: fallo.jurisdiccion,
      jurisdiccion_detalle: fallo.jurisdiccion_detalle || null,
      last_ingested_run_id: fallo.last_ingested_run_id || '',
      magistrados: fallo.magistrados || '',
      materia: fallo.materia,
      number: fallo.number || '',
      objeto: fallo.objeto || null,
      observaciones: fallo.observaciones || null,
      organismo_emisor: fallo.organismo_emisor || null,
      publication_date: fallo.publication_date,
      referencias_bibliograficas: fallo.referencias_bibliograficas || [],
      referencias_jurisprudenciales: fallo.referencias_jurisprudenciales || [],
      referencias_normativas: fallo.referencias_normativas || [],
      relaciones_salientes: fallo.relaciones_salientes || [],
      sala: fallo.sala,
      sanction_date: fallo.sanction_date,
      sigla_emisor: fallo.sigla_emisor || null,
      subestado: fallo.subestado || '',
      sumario: fallo.sumario,
      sumario_extendido: fallo.sumario_extendido || '',
      tags: fallo.tags || [],
      tipo_contenido: fallo.tipo_contenido,
      tipo_detalle: fallo.tipo_detalle || '',
      tipo_general: fallo.tipo_general,
      title: fallo.title,
      tribunal: fallo.tribunal,
      url: fallo.url || '',
      relaciones: fallo.relaciones || [],
      created_at: fallo.created_at,
      updated_at: fallo.updated_at
    };
  } catch (error) {
    console.error('Error fetching fallo by ID:', error);
    throw new Error('Failed to fetch fallo');
  }
};

// Get facets for filter options
export const getFallosFacets = async (filters: FalloFilters = {}) => {
  const baseFilter = buildMongoFilter(filters);

  try {
    const facetsAggregation = [
      { $match: baseFilter },
      {
        $facet: {
          jurisdicciones: [
            { $group: { _id: '$jurisdiccion', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          tribunales: [
            { $group: { _id: '$tribunal', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          materias: [
            { $group: { _id: '$materia', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          estados: [
            { $group: { _id: '$estado', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          // tags: [
          //   { $unwind: '$tags' },
          //   { $group: { _id: '$tags', count: { $sum: 1 } } },
          //   { $sort: { count: -1 } }
          // ],
          fuentes: [
            { $group: { _id: '$fuente', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          tipos_contenido: [
            { $group: { _id: '$tipo_contenido', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          tipos_general: [
            { $group: { _id: '$tipo_general', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          tipos_detalle: [
            { $group: { _id: '$tipo_detalle', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          subestados: [
            { $group: { _id: '$subestado', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          country_codes: [
            { $group: { _id: '$country_code', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        }
      }
    ];

    const [facetsResult] = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(FALLOS_COLLECTION_NAME);
      return await collection.aggregate(facetsAggregation).toArray();
    });

    // Handle case where aggregation returns undefined or empty result
    if (!facetsResult) {
      return {
        jurisdicciones: {},
        tribunales: {},
        materias: {},
        estados: {},
        tags: {},
        fuentes: {},
        tipos_contenido: {},
        tipos_general: {},
        tipos_detalle: {},
        subestados: {},
        country_codes: {}
      };
    }

    return {
      jurisdicciones: (facetsResult.jurisdicciones || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tribunales: (facetsResult.tribunales || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      materias: (facetsResult.materias || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      estados: (facetsResult.estados || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tags: (facetsResult.tags || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      fuentes: (facetsResult.fuentes || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tipos_contenido: (facetsResult.tipos_contenido || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tipos_general: (facetsResult.tipos_general || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tipos_detalle: (facetsResult.tipos_detalle || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      subestados: (facetsResult.subestados || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      country_codes: (facetsResult.country_codes || []).map((item: any) => ({
        name: item._id,
        count: item.count,
      }))
    };
  } catch (error) {
    console.error('Error fetching fallos facets:', error);
    throw new Error('Failed to fetch fallos facets');
  }
};
