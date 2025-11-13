'use node'

import { MongoClient, Filter, Sort, Document, ObjectId } from 'mongodb';
import { NormativeDoc, NormativeFilters, ListNormativesParams, SortBy, SortOrder, Estado, Subestado } from '../../types/legislation';
import { LEGISLATION_COLLECTION_NAME } from '../rag/qdrantUtils/legislationConfig';

// Mapping table: Estado -> Subestados habilitados
const estadoSubestadoMapping: Record<Estado, Subestado[]> = {
  vigente: ["alcance_general", "individual_modificatoria_o_sin_eficacia"],
  anulada: ["vetada"],
  derogada: ["derogada"],
  abrogada: ["abrogada_implicita"],
  caduca: ["ley_caduca", "refundida_ley_caduca"],
  sin_registro_oficial: ["sin_registro"],
  suspendida: [], // No subestados específicos según la tabla
};

// Mapping table: Tipo General -> Tipo Detalle patterns
// Since tipo_detalle values are dynamic from MongoDB, we use pattern matching
const tipoGeneralDetalleMapping: Record<string, (detalle: string) => boolean> = {
  Ley: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("ley") ||
      lowerDetalle.includes("decreto ley") ||
      lowerDetalle.includes("tratado") ||
      lowerDetalle.includes("código") ||
      lowerDetalle.includes("codigo") ||
      lowerDetalle.includes("constitución") ||
      lowerDetalle.includes("constitucion") ||
      lowerDetalle.includes("texto ordenado ley") ||
      lowerDetalle.includes("ley de contrato de trabajo") ||
      lowerDetalle.includes("ley de procedimientos administrativos") ||
      lowerDetalle.includes("norma jurídica de hecho") ||
      lowerDetalle.includes("norma juridica de hecho")
    );
  },
  Decreto: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("decreto") &&
      !lowerDetalle.includes("decreto ley") &&
      (lowerDetalle.includes("dnu") ||
        lowerDetalle.includes("decreto de necesidad y urgencia") ||
        lowerDetalle.includes("decreto ordenanza") ||
        lowerDetalle.includes("texto ordenado decreto"))
    );
  },
  Resolución: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("resolución") ||
      lowerDetalle.includes("resolucion") ||
      lowerDetalle.includes("resol.")
    );
  },
  Decisión: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("decisión") ||
      lowerDetalle.includes("decision") ||
      lowerDetalle.includes("mercosur")
    );
  },
  Disposición: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("disposición") ||
      lowerDetalle.includes("disposicion") ||
      lowerDetalle.includes("técnico registral") ||
      lowerDetalle.includes("tecnico registral")
    );
  },
  Acordada: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return lowerDetalle.includes("acordada");
  },
};

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
    console.log('Returning cached tipo_general values');
    return tipoGeneralCache.values;
  }
  
  try {
    console.log('Fetching distinct tipo_general values from MongoDB...');
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);
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

// Cache for tipo_detalle enum values
interface TipoDetalleCache {
  values: string[];
  timestamp: number;
}

let tipoDetalleCache: TipoDetalleCache | null = null;

// Get distinct tipo_detalle values with caching
export const getTipoDetalleValues = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached values if still valid
  if (tipoDetalleCache && (now - tipoDetalleCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Returning cached tipo_detalle values');
    return tipoDetalleCache.values;
  }
  
  try {
    console.log('Fetching distinct tipo_detalle values from MongoDB...');
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);
      return await collection.distinct('tipo_detalle', {
        tipo_detalle: { $exists: true, $ne: null }
      });
    });
    
    // Filter out null/undefined and sort
    const validValues = distinctValues
      .filter((val): val is string => typeof val === 'string' && val.length > 0)
      .sort();
    
    // Update cache
    tipoDetalleCache = {
      values: validValues,
      timestamp: now
    };
    
    console.log(`Cached ${validValues.length} tipo_detalle values:`, validValues);
    return validValues;
  } catch (error) {
    console.error('Error fetching tipo_detalle values:', error);
    // Return cached values if available, even if expired
    if (tipoDetalleCache) {
      console.warn('Using expired cache due to error');
      return tipoDetalleCache.values;
    }
    throw new Error('Failed to fetch tipo_detalle values');
  }
};

// Cache for jurisdiccion enum values
interface JurisdiccionCache {
  values: string[];
  timestamp: number;
}

let jurisdiccionCache: JurisdiccionCache | null = null;

// Cache clearing function
export const clearLegislationCache = () => {
  tipoGeneralCache = null;
  tipoDetalleCache = null;
  jurisdiccionCache = null;
  console.log('Legislation cache cleared');
};

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
    const distinctValues = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);
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

  // Validate filter compatibility before applying filters
  // Create a validated filters object
  let validatedFilters = { ...filters };

  // Validate estado + subestado compatibility
  if (validatedFilters.estado && validatedFilters.subestado) {
    const allowedSubestados = estadoSubestadoMapping[validatedFilters.estado] || [];
    if (!allowedSubestados.includes(validatedFilters.subestado)) {
      console.warn(
        `Invalid filter combination: estado=${validatedFilters.estado}, subestado=${validatedFilters.subestado}. ` +
        `Ignoring subestado filter. Allowed subestados for ${validatedFilters.estado}: ${allowedSubestados.join(", ")}`
      );
      // Remove incompatible subestado filter
      const { subestado, ...restFilters } = validatedFilters;
      validatedFilters = restFilters as NormativeFilters;
    }
  }

  // Validate tipo_general + tipo_detalle compatibility
  if (validatedFilters.tipo_general && validatedFilters.tipo_detalle) {
    const matcher = tipoGeneralDetalleMapping[validatedFilters.tipo_general];
    if (matcher && !matcher(validatedFilters.tipo_detalle)) {
      console.warn(
        `Invalid filter combination: tipo_general=${validatedFilters.tipo_general}, tipo_detalle=${validatedFilters.tipo_detalle}. ` +
        `Ignoring tipo_detalle filter.`
      );
      // Remove incompatible tipo_detalle filter
      const { tipo_detalle, ...restFilters } = validatedFilters;
      validatedFilters = restFilters as NormativeFilters;
    }
  }

  // Use validated filters for the rest of the function
  // Jurisdiccion filter
  if (validatedFilters.jurisdiccion) {
    mongoFilter.jurisdiccion = validatedFilters.jurisdiccion;
  }

  // Tipo norma filter - check both old and new field names (OR within type variations)
  if (validatedFilters.type) {
    andConditions.push({
      $or: [
        { tipo_general: validatedFilters.type },
        { tipo_norma: validatedFilters.type },
        { type: validatedFilters.type }
      ]
    });
  }

  // New field filters
  if (validatedFilters.tipo_general) {
    mongoFilter.tipo_general = validatedFilters.tipo_general;
  }
  if (validatedFilters.tipo_detalle) {
    mongoFilter.tipo_detalle = validatedFilters.tipo_detalle;
  }
  if (validatedFilters.tipo_contenido) {
    mongoFilter.tipo_contenido = validatedFilters.tipo_contenido;
  }
  if (validatedFilters.subestado) {
    mongoFilter.subestado = validatedFilters.subestado;
  }

  // Estado filter
  if (validatedFilters.estado) {
    mongoFilter.estado = validatedFilters.estado;
  }

  // Date range filters - using date string fields (sanction_date)
  if (validatedFilters.sanction_date_from || validatedFilters.sanction_date_to) {
    mongoFilter.sanction_date = {};
    if (validatedFilters.sanction_date_from) {
      mongoFilter.sanction_date.$gte = validatedFilters.sanction_date_from;
    }
    if (validatedFilters.sanction_date_to) {
      mongoFilter.sanction_date.$lte = validatedFilters.sanction_date_to;
    }
  }

  // Publication date range - using date string fields (publication_date)
  if (validatedFilters.publication_date_from || validatedFilters.publication_date_to) {
    mongoFilter.publication_date = {};
    if (validatedFilters.publication_date_from) {
      mongoFilter.publication_date.$gte = validatedFilters.publication_date_from;
    }
    if (validatedFilters.publication_date_to) {
      mongoFilter.publication_date.$lte = validatedFilters.publication_date_to;
    }
  }

  // Number filter - check both old and new field names (OR within number variations)
  if (validatedFilters.number) {
    andConditions.push({
      $or: [
        { number: validatedFilters.number },
        { numero: validatedFilters.number }
      ]
    });
  }

  // Text search in title and content (OR between title and content)
  if (validatedFilters.search) {
    andConditions.push({
      $or: [
        { title: { $regex: validatedFilters.search, $options: 'i' } },
        { content: { $regex: validatedFilters.search, $options: 'i' } }
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
      return { sanction_date: order, _id: -1 };
    case 'updated_at':
      return { updated_at: order, _id: -1 };
    case 'created_at':
      return { indexed_at: order, _id: -1 }; // using indexed_at as created_at equivalent
    default:
      return { sanction_date: order, _id: -1 };
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
    // Execute query with retry logic
    const { total, normatives } = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);

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

      return { total, normatives };
    });

    // Map normatives to ensure consistent data structure
    const mappedNormatives: NormativeDoc[] = normatives.map((normative) => {
      // Use date fields directly from MongoDB
      const publicationDate = normative.publication_date;
      const sanctionDate = normative.sanction_date;

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
  try {
    // Create query filter - try both _id and document_id
    const queryFilter = { document_id: documentId };

    // Use projection to limit fields returned from MongoDB (exclude large content fields)
    const normative = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);
      return await collection.findOne(
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
    });

    if (!normative) {
      return null;
    }

    // Use date fields directly from MongoDB
    const publicationDate = normative.publication_date;
    const sanctionDate = normative.sanction_date;

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
          subestados: [
            { $match: { subestado: { $exists: true, $ne: null } } },
            { $group: { _id: '$subestado', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          tipos_detalle: [
            { $match: { tipo_detalle: { $exists: true, $ne: null } } },
            { $group: { _id: '$tipo_detalle', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          years: [
            {
              $match: {
                sanction_date: { $exists: true, $ne: null }
              }
            },
            {
              $addFields: {
                sanctionDate: {
                  $toDate: '$sanction_date'
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

    const [facetsResult] = await withMongoRetry(async (client) => {
      const db = client.db(process.env.MONGODB_DATABASE_NAME);
      const collection = db.collection(LEGISLATION_COLLECTION_NAME);
      return await collection.aggregate(facetsAggregation).toArray();
    });

    return {
      jurisdicciones: facetsResult.jurisdicciones.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tipos: facetsResult.tipos.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      estados: facetsResult.estados.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      subestados: facetsResult.subestados.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      tipos_detalle: facetsResult.tipos_detalle.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
      years: facetsResult.years.map((item: any) => ({
        name: item._id,
        count: item.count,
      }))
    };
  } catch (error) {
    console.error('Error fetching facets:', error);
    throw new Error('Failed to fetch facets');
  }
};
