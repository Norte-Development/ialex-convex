'use node'

import { MongoClient, Filter, Sort, Document, ObjectId } from 'mongodb';
import { FalloDoc, FalloFilters, ListFallosParams, FalloSortBy, FalloSortOrder, PaginatedResult } from '../../types/fallos';
import { FALLOS_COLLECTION_NAME } from '../rag/qdrantUtils/fallosConfig';

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
    const mongoClient = getMongoClient();
    const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(FALLOS_COLLECTION_NAME);
    
    const distinctValues = await collection.distinct('tipo_general', {
      tipo_general: { $exists: true, $ne: null }
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

// Cache clearing function
export const clearFallosCache = () => {
  tipoGeneralCache = null;
  jurisdiccionCache = null;
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
    const mongoClient = getMongoClient();
    const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(FALLOS_COLLECTION_NAME);
    
    const distinctValues = await collection.distinct('jurisdiccion', {
      jurisdiccion: { $exists: true, $ne: null }
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

  // Date range filters - using ISO date strings
  if (filters.fecha_from || filters.fecha_to) {
    mongoFilter.fecha = {};
    if (filters.fecha_from) {
      mongoFilter.fecha.$gte = filters.fecha_from;
    }
    if (filters.fecha_to) {
      mongoFilter.fecha.$lte = filters.fecha_to;
    }
  }

  if (filters.promulgacion_from || filters.promulgacion_to) {
    mongoFilter.promulgacion = {};
    if (filters.promulgacion_from) {
      mongoFilter.promulgacion.$gte = filters.promulgacion_from;
    }
    if (filters.promulgacion_to) {
      mongoFilter.promulgacion.$lte = filters.promulgacion_to;
    }
  }

  if (filters.publicacion_from || filters.publicacion_to) {
    mongoFilter.publicacion = {};
    if (filters.publicacion_from) {
      mongoFilter.publicacion.$gte = filters.publicacion_from;
    }
    if (filters.publicacion_to) {
      mongoFilter.publicacion.$lte = filters.publicacion_to;
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

  // Text search in title, content, and materia
  if (filters.search) {
    andConditions.push({
      $or: [
        { titulo: { $regex: filters.search, $options: 'i' } },
        { contenido: { $regex: filters.search, $options: 'i' } },
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
    case 'fecha':
      return { fecha: order, _id: -1 };
    case 'promulgacion':
      return { promulgacion: order, _id: -1 };
    case 'publicacion':
      return { publicacion: order, _id: -1 };
    case 'created_at':
      return { created_at: order, _id: -1 };
    case 'updated_at':
      return { updated_at: order, _id: -1 };
    default:
      // Default sort by fecha with _id as secondary sort
      return { fecha: order, _id: -1 };
  }
};

export const getFallos = async (params: ListFallosParams = {}): Promise<PaginatedResult<FalloDoc>> => {
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(FALLOS_COLLECTION_NAME);
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
    // Get total count for pagination
    const total = await collection.countDocuments(mongoFilter);

    // Get paginated results with limited fields (exclude large content fields)
    const fallos = await collection
      .find(mongoFilter)
      .project({
        // Exclude large content fields to improve performance
        contenido: 0,
        relaciones: 0,
        created_at: 0,
        updated_at: 0
      })
      .sort(mongoSort)
      .skip(validatedOffset)
      .limit(validatedLimit)
      .toArray();

    // Map fallos to ensure consistent data structure
    const mappedFallos: FalloDoc[] = fallos.map((fallo) => ({
      _id: fallo._id.toString(),
      document_id: fallo.document_id,
      tipo_contenido: fallo.tipo_contenido,
      tipo_general: fallo.tipo_general,
      jurisdiccion: fallo.jurisdiccion,
      tribunal: fallo.tribunal,
      magistrados: fallo.magistrados || [],
      actor: fallo.actor,
      demandado: fallo.demandado,
      sala: fallo.sala,
      titulo: fallo.titulo,
      contenido: '', // Empty string since contenido is excluded in projection
      fecha: fallo.fecha,
      promulgacion: fallo.promulgacion,
      publicacion: fallo.publicacion,
      sumario: fallo.sumario,
      materia: fallo.materia,
      tags: fallo.tags || [],
      referencias_normativas: fallo.referencias_normativas || [],
      citas: fallo.citas || [],
      estado: fallo.estado
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
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(FALLOS_COLLECTION_NAME);

  try {
    // Create query filter
    const queryFilter = { document_id: documentId };

    // Get full document including content
    const fallo = await collection.findOne(queryFilter);

    if (!fallo) {
      return null;
    }

    return {
      _id: fallo._id.toString(),
      document_id: fallo.document_id,
      tipo_contenido: fallo.tipo_contenido,
      tipo_general: fallo.tipo_general,
      jurisdiccion: fallo.jurisdiccion,
      tribunal: fallo.tribunal,
      magistrados: fallo.magistrados || [],
      actor: fallo.actor,
      demandado: fallo.demandado,
      sala: fallo.sala,
      titulo: fallo.titulo,
      contenido: fallo.contenido,
      fecha: fallo.fecha,
      promulgacion: fallo.promulgacion,
      publicacion: fallo.publicacion,
      sumario: fallo.sumario,
      materia: fallo.materia,
      tags: fallo.tags || [],
      referencias_normativas: fallo.referencias_normativas || [],
      citas: fallo.citas || [],
      estado: fallo.estado,
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
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(FALLOS_COLLECTION_NAME);

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
          tags: [
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]
        }
      }
    ];

    const [facetsResult] = await collection.aggregate(facetsAggregation).toArray();

    return {
      jurisdicciones: Object.fromEntries(
        facetsResult.jurisdicciones.map((item: any) => [item._id, item.count])
      ),
      tribunales: Object.fromEntries(
        facetsResult.tribunales.map((item: any) => [item._id, item.count])
      ),
      materias: Object.fromEntries(
        facetsResult.materias.map((item: any) => [item._id, item.count])
      ),
      estados: Object.fromEntries(
        facetsResult.estados.map((item: any) => [item._id, item.count])
      ),
      tags: Object.fromEntries(
        facetsResult.tags.map((item: any) => [item._id, item.count])
      )
    };
  } catch (error) {
    console.error('Error fetching fallos facets:', error);
    throw new Error('Failed to fetch fallos facets');
  }
};
