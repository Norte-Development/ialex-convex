'use node'

import { MongoClient, Filter, Sort, Document, ObjectId } from 'mongodb';
import { NormativeDoc, NormativeFilters, ListNormativesParams, SortBy, SortOrder } from '../../types/legislation';

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
  const orConditions: any[] = [];

  // Jurisdiccion filter
  if (filters.jurisdiccion) {
    mongoFilter.jurisdiccion = filters.jurisdiccion;
  }

  // Tipo norma filter - check both old and new field names
  if (filters.type) {
    orConditions.push(
      { tipo_general: filters.type },
      { tipo_norma: filters.type },
      { type: filters.type }
    );
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

  // Date range filters
  if (filters.sanction_date_from || filters.sanction_date_to) {
    mongoFilter.sanction_date = {};
    if (filters.sanction_date_from) {
      mongoFilter.sanction_date.$gte = new Date(filters.sanction_date_from);
    }
    if (filters.sanction_date_to) {
      mongoFilter.sanction_date.$lte = new Date(filters.sanction_date_to);
    }
  }

  // Publication date range
  if (filters.publication_date_from || filters.publication_date_to) {
    mongoFilter.publication_date = {};
    if (filters.publication_date_from) {
      mongoFilter.publication_date.$gte = new Date(filters.publication_date_from);
    }
    if (filters.publication_date_to) {
      mongoFilter.publication_date.$lte = new Date(filters.publication_date_to);
    }
  }

  // Number filter - check both old and new field names
  if (filters.number) {
    orConditions.push(
      { number: filters.number },
      { numero: filters.number }
    );
  }

  // Text search in title and content
  if (filters.search) {
    orConditions.push(
      { title: { $regex: filters.search, $options: 'i' } },
      { content: { $regex: filters.search, $options: 'i' } }
    );
  }

  // Add $or conditions if any exist
  if (orConditions.length > 0) {
    mongoFilter.$or = orConditions;
  }

  return mongoFilter;
};

// Build MongoDB sort from sort parameters
const buildMongoSort = (sortBy?: SortBy, sortOrder: SortOrder = 'desc'): Sort => {
  const order = sortOrder === 'asc' ? 1 : -1;

  switch (sortBy) {
    case 'sanction_date':
      return { sanction_date: order };
    case 'updated_at':
      return { updated_at: order };
    case 'created_at':
      return { indexed_at: order }; // using indexed_at as created_at equivalent
    default:
      return { sanction_date: order }; // default sort by sanction date
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
  const db = mongoClient.db('ialex_legislation');
  const collection = db.collection('ialex_legislation_py');

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
    const mappedNormatives: NormativeDoc[] = normatives.map((normative) => ({
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
        publication_date: normative.publication_date,
        sanction_date: normative.sanction_date,
        indexed_at: normative.indexed_at
      },
      materia: normative.materia,
      tags: normative.tags,
      subestado: normative.subestado,
      resumen: normative.resumen,
      url: normative.url
    }));

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
  const db = mongoClient.db('ialex_legislation');
  const collection = db.collection('ialex_legislation_py');

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
        publication_date: normative.publication_date,
        sanction_date: normative.sanction_date,
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
  const db = mongoClient.db('ialex_legislation');
  const collection = db.collection('ialex_legislation_py');

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
              $addFields: {
                parsedSanctionDate: {
                  $dateFromString: {
                    dateString: '$sanction_date',
                    onError: null
                  }
                }
              }
            },
            {
              $match: {
                parsedSanctionDate: { $ne: null }
              }
            },
            {
              $group: {
                _id: { $year: '$parsedSanctionDate' },
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