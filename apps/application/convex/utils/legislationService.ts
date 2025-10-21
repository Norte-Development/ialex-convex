'use node'

import { MongoClient, Filter, Sort, Document, ObjectId } from 'mongodb';
import { NormativeDoc, NormativeFilters, ListNormativesParams, SortBy, SortOrder } from '../../types/legislation';
import { LEGISLATION_COLLECTION_NAME } from '../rag/qdrantUtils/legislationConfig';

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
    console.log('Returning cached tipo_general values');
    return tipoGeneralCache.values;
  }
  
  try {
    console.log('Fetching distinct tipo_general values from MongoDB...');
    const mongoClient = getMongoClient();
    const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(LEGISLATION_COLLECTION_NAME);
    
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
    
    console.log(`Cached ${validValues.length} tipo_general values:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching tipo_general values:', error);
    // Return cached values if available, even if expired
    if (tipoGeneralCache) {
      console.warn('Using expired cache due to error');
      return tipoGeneralCache.values;
    }
    throw new Error('Failed to fetch tipo_general values');
  }
};

// Cache for jurisdiccion enum values
interface JurisdiccionCache {
  values: string[];
  timestamp: number;
}

let jurisdiccionCache: JurisdiccionCache | null = null;

// Get distinct jurisdiccion values with caching
export const getJurisdiccionValues = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached values if still valid
  if (jurisdiccionCache && (now - jurisdiccionCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Returning cached jurisdiccion values');
    return jurisdiccionCache.values;
  }
  
  try {
    console.log('Fetching distinct jurisdiccion values from MongoDB...');
    const mongoClient = getMongoClient();
    const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(LEGISLATION_COLLECTION_NAME);
    
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
    
    console.log(`Cached ${validValues.length} jurisdiccion values:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching jurisdiccion values:', error);
    // Return cached values if available, even if expired
    if (jurisdiccionCache) {
      console.warn('Using expired cache due to error');
      return jurisdiccionCache.values;
    }
    throw new Error('Failed to fetch jurisdiccion values');
  }
};

// // Utility function to convert documentId to ObjectId if it's a valid ObjectId string
// const convertToObjectId = (id: string): ObjectId | string => {
//   // Check if the id is a valid ObjectId (24 hex characters)
//   if (/^[0-9a-fA-F]{24}$/.test(id)) {
//     try {
//       return new ObjectId(id);
//     } catch (error) {
//       // If conversion fails, return the original string
//       return id;
//     }
//   }
//   // If it's not a valid ObjectId format, return as string (for document_id queries)
//   return id;
// };

// Build MongoDB filter from filters object
const buildMongoFilter = (filters: NormativeFilters): Filter<Document> => {
  const mongoFilter: Filter<Document> = {};
  const andConditions: any[] = [];

  // Jurisdiccion filter
  if (filters.jurisdiccion) {
    mongoFilter.jurisdiccion = filters.jurisdiccion;
  }

  // Tipo norma filter - check both old and new field names (OR within type variations)
  if (filters.type) {
    andConditions.push({
      $or: [
        { tipo_general: filters.type },
        { tipo_norma: filters.type },
        { type: filters.type }
      ]
    });
  }

  // New field filters
  if (filters.tipo_general) {
    mongoFilter.tipo_general = filters.tipo_general;
  }
  if (filters.tipo_detalle) {
    mongoFilter.tipo_detalle = filters.tipo_detalle;
  }
  if (filters.tipo_contenido) {
    mongoFilter.tipo_contenido = filters.tipo_contenido;
  }
  if (filters.subestado) {
    mongoFilter.subestado = filters.subestado;
  }

  // Estado filter
  if (filters.estado) {
    mongoFilter.estado = filters.estado;
  }

  // Date range filters - using timestamp fields (sanction_ts)
  if (filters.sanction_date_from || filters.sanction_date_to) {
    mongoFilter.sanction_ts = {};
    if (filters.sanction_date_from) {
      // Convert date string to Unix timestamp in seconds
      mongoFilter.sanction_ts.$gte = Math.floor(new Date(filters.sanction_date_from).getTime() / 1000);
    }
    if (filters.sanction_date_to) {
      // Convert date string to Unix timestamp in seconds
      mongoFilter.sanction_ts.$lte = Math.floor(new Date(filters.sanction_date_to).getTime() / 1000);
    }
  }

  // Publication date range - using timestamp fields (publication_ts)
  if (filters.publication_date_from || filters.publication_date_to) {
    mongoFilter.publication_ts = {};
    if (filters.publication_date_from) {
      // Convert date string to Unix timestamp in seconds
      mongoFilter.publication_ts.$gte = Math.floor(new Date(filters.publication_date_from).getTime() / 1000);
    }
    if (filters.publication_date_to) {
      // Convert date string to Unix timestamp in seconds
      mongoFilter.publication_ts.$lte = Math.floor(new Date(filters.publication_date_to).getTime() / 1000);
    }
  }

  // Number filter - check both old and new field names (OR within number variations)
  if (filters.number) {
    andConditions.push({
      $or: [
        { number: filters.number },
        { numero: filters.number }
      ]
    });
  }

  // Text search in title and content (OR between title and content)
  if (filters.search) {
    andConditions.push({
      $or: [
        { title: { $regex: filters.search, $options: 'i' } },
        { content: { $regex: filters.search, $options: 'i' } }
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
const buildMongoSort = (sortBy?: SortBy, sortOrder: SortOrder = 'desc'): Sort => {
  const order = sortOrder === 'asc' ? 1 : -1;
  
  switch (sortBy) {
    case 'sanction_date':
      // Use sanction_ts timestamp field with _id as secondary sort for stability
      return { sanction_ts: order, _id: -1 };
    case 'updated_at':
      return { updated_at: order, _id: -1 };
    case 'created_at':
      return { indexed_at: order, _id: -1 }; // using indexed_at as created_at equivalent
    default:
      // Default sort by sanction_ts timestamp with _id as secondary sort
      return { sanction_ts: order, _id: -1 };
  }
};

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const getNormatives = async (params: ListNormativesParams = {}): Promise<PaginatedResult<NormativeDoc>> => {
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(LEGISLATION_COLLECTION_NAME);
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

  console.log('MongoDB filter:', JSON.stringify(mongoFilter, null, 2));
  console.log('MongoDB sort:', mongoSort);

  try {
    // Get total count for pagination
    const total = await collection.countDocuments(mongoFilter);

    // Get paginated results with limited fields (exclude large content fields)
    const normatives = await collection
      .find(mongoFilter)
      .project({
        // Exclude large content fields to improve performance
        content: 0,
        texto: 0,
        articulos: 0,
        aprobacion: 0,
        relaciones: 0,
        created_at: 0,
        updated_at: 0,
        content_hash: 0
      })
      .sort(mongoSort)
      .skip(validatedOffset)
      .limit(validatedLimit)
      .toArray();

    // Map normatives to ensure consistent data structure
    const mappedNormatives: NormativeDoc[] = normatives.map((normative) => {
      // Convert timestamps to ISO date strings
      const publicationDate = normative.publication_ts 
        ? new Date(normative.publication_ts * 1000).toISOString()
        : normative.publication_date;
      
      const sanctionDate = normative.sanction_ts
        ? new Date(normative.sanction_ts * 1000).toISOString()
        : normative.sanction_date;

      return {
        _id: normative._id.toString(),
        document_id: normative.document_id,
        type: normative.tipo_general || normative.tipo_norma || normative.type,
        title: normative.title,
        jurisdiccion: normative.jurisdiccion,
        estado: normative.estado,
        country_code: normative.country_code,
        numero: normative.number || normative.numero,
        fuente: normative.fuente,
        dates: {
          publication_date: publicationDate,
          sanction_date: sanctionDate,
          indexed_at: normative.indexed_at
        },
        materia: normative.materia,
        tags: normative.tags,
        subestado: normative.subestado,
        resumen: normative.resumen,
        url: normative.url
      };
    });

    // Calculate pagination info
    const page = Math.floor(validatedOffset / validatedLimit) + 1;
    const totalPages = Math.ceil(total / validatedLimit);

    return {
      items: mappedNormatives,
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
    console.error('Error fetching normatives:', error);
    throw new Error('Failed to fetch normatives');
  }
};

// Get a single normative by document_id (limited fields, no content)
export const getNormativeById = async (documentId: string): Promise<NormativeDoc | null> => {
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(LEGISLATION_COLLECTION_NAME);

  try {

    // Create query filter - try both _id and document_id
    const queryFilter = { document_id: documentId }
      

    // Use projection to limit fields returned from MongoDB (exclude large content fields)
    const normative = await collection.findOne(
      queryFilter,
      {
        projection: {
          // Exclude large content fields to improve performance
          texto: 0,
          articulos: 0,
          aprobacion: 0,
          relaciones: 0,
          created_at: 0,
          updated_at: 0,
          content_hash: 0
        }
      }
    );

    if (!normative) {
      return null;
    }

    // Convert timestamps to ISO date strings
    const publicationDate = normative.publication_ts 
      ? new Date(normative.publication_ts * 1000).toISOString()
      : normative.publication_date;
    
    const sanctionDate = normative.sanction_ts
      ? new Date(normative.sanction_ts * 1000).toISOString()
      : normative.sanction_date;

    return {
      _id: normative._id.toString(),
      document_id: normative.document_id,
      type: normative.tipo_general || normative.tipo_norma || normative.type,
      title: normative.title,
      jurisdiccion: normative.jurisdiccion,
      estado: normative.estado,
      country_code: normative.country_code,
      numero: normative.number || normative.numero,
      fuente: normative.fuente,
      dates: {
        publication_date: publicationDate,
        sanction_date: sanctionDate,
        indexed_at: normative.indexed_at
      },
      materia: normative.materia,
      tags: normative.tags,
      subestado: normative.subestado,
      resumen: normative.resumen,
      url: normative.url,
      content: normative.content,
    };
  } catch (error) {
    console.error('Error fetching normative by ID:', error);
    throw new Error('Failed to fetch normative');
  }
};

// Get facets for filter options
export const getNormativesFacets = async (filters: NormativeFilters = {}) => {
  const mongoClient = getMongoClient();
  const db = mongoClient.db(process.env.MONGODB_DATABASE_NAME);
  const collection = db.collection(LEGISLATION_COLLECTION_NAME);

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
          tipos: [
            { $group: { _id: '$tipo_norma', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          estados: [
            { $group: { _id: '$estado', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          years: [
            {
              $match: {
                sanction_ts: { $exists: true, $ne: null }
              }
            },
            {
              $addFields: {
                sanctionDate: {
                  $toDate: { $multiply: ['$sanction_ts', 1000] }
                }
              }
            },
            {
              $group: {
                _id: { $year: '$sanctionDate' },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: -1 } }
          ]
        }
      }
    ];

    const [facetsResult] = await collection.aggregate(facetsAggregation).toArray();

    return {
      jurisdicciones: Object.fromEntries(
        facetsResult.jurisdicciones.map((item: any) => [item._id, item.count])
      ),
      tipos: Object.fromEntries(
        facetsResult.tipos.map((item: any) => [item._id, item.count])
      ),
      estados: Object.fromEntries(
        facetsResult.estados.map((item: any) => [item._id, item.count])
      ),
      years: Object.fromEntries(
        facetsResult.years.map((item: any) => [item._id, item.count])
      )
    };
  } catch (error) {
    console.error('Error fetching facets:', error);
    throw new Error('Failed to fetch facets');
  }
};
