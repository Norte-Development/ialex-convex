// Core types for fallos (jurisprudencia) data

export type EstadoFallo = string; // Now generic string to match MongoDB

export type TipoContenidoFallo = string; // Now generic string to match MongoDB

export type TipoGeneralFallo = string; // Dynamically loaded from MongoDB

// Main document interface matching MongoDB structure
export interface FalloDoc {
  _id?: string; // MongoDB ObjectId
  document_id: string;
  actor: string;
  autor: string;
  citas: string[];
  content: string; // was 'contenido'
  content_hash: string;
  country_code: string;
  date: string; // was 'fecha'
  date_source: string;
  demandado: string;
  estado: string; // was specific enum, now generic string
  fuente: string;
  indexed_at: string;
  jurisdiccion: string;
  jurisdiccion_detalle: string | null;
  last_ingested_run_id: string;
  magistrados: string; // was string[], now string
  materia: string;
  number: string;
  objeto: string | null;
  observaciones: string | null;
  organismo_emisor: string | null;
  publication_date: string; // was 'publicacion'
  referencias_bibliograficas: string[];
  referencias_jurisprudenciales: string[];
  referencias_normativas: string[];
  relaciones_salientes: string[];
  sala: string;
  sanction_date: string;
  sigla_emisor: string | null;
  subestado: string;
  sumario: string;
  sumario_extendido: string;
  tags: string[];
  tipo_contenido: string; // was specific enum
  tipo_detalle: string;
  tipo_general: string;
  title: string; // was 'titulo'
  tribunal: string;
  url: string;
  relaciones: string[];
  created_at?: string;
  updated_at?: string;
}

// Filter parameters for MongoDB queries
export interface FalloFilters {
  jurisdiccion?: string;
  tribunal?: string;
  materia?: string;
  estado?: string; // Now generic string
  date_from?: string; // ISO date string (was fecha_from)
  date_to?: string; // ISO date string (was fecha_to)
  sanction_date_from?: string; // ISO date string
  sanction_date_to?: string; // ISO date string
  publication_date_from?: string; // ISO date string (was publicacion_from)
  publication_date_to?: string; // ISO date string (was publicacion_to)
  actor?: string; // case-insensitive search
  demandado?: string; // case-insensitive search
  magistrados?: string; // case-insensitive search
  tags?: string[]; // array of tags to match
  search?: string; // text search in title, content, materia
  document_id?: string; // exact match
  tipo_contenido?: string; // Now generic string
  tipo_general?: string; // Now generic string
  sala?: string;
  country_code?: string;
  fuente?: string;
  subestado?: string;
  tipo_detalle?: string;
  // Legacy field mappings for backward compatibility
  fecha_from?: string; // Maps to date_from
  fecha_to?: string; // Maps to date_to
  promulgacion_from?: string; // Maps to sanction_date_from
  promulgacion_to?: string; // Maps to sanction_date_to
  publicacion_from?: string; // Maps to publication_date_from
  publicacion_to?: string; // Maps to publication_date_to
}

// Pagination and sorting parameters
export interface ListFallosParams {
  filters?: FalloFilters;
  limit?: number; // 1-100, default 20
  offset?: number; // >=0, default 0
  sortBy?: FalloSortBy;
  sortOrder?: FalloSortOrder;
}

// Sorting options
// Supports both new field names and legacy Spanish field names for backward compatibility
export type FalloSortBy = "date" | "sanction_date" | "publication_date" | "relevancia" | "created_at" | "updated_at" | "indexed_at" | "fecha" | "promulgacion" | "publicacion";
export type FalloSortOrder = "asc" | "desc";

// Reusable pagination response type
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

// Search result interface for Qdrant search
export interface FalloSearchResult {
  id: string; // document_id
  score: number;
  payload: {
    document_id: string;
    title: string; // was 'titulo'
    tribunal: string;
    jurisdiccion: string;
    date: string; // was 'fecha'
    sanction_date: string; // was 'promulgacion'
    actor: string;
    demandado: string;
    magistrados: string; // was string[], now string
    materia: string;
    tags: string[];
    sumario: string;
    content: string; // was 'contenido'
    url: string;
    sala: string;
  };
}

// Chunk search result for document reading
export interface FalloChunkResult {
  document_id: string;
  chunk_index: number;
  text: string;
  score: number;
}

// Facets for filters UI - Now arrays instead of objects
export interface FallosFacets {
  jurisdicciones: Array<{ name: string; count: number }>;
  tribunales: Array<{ name: string; count: number }>;
  materias: Array<{ name: string; count: number }>;
  estados: Array<{ name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
  fuentes: Array<{ name: string; count: number }>;
  tipos_contenido: Array<{ name: string; count: number }>;
  tipos_general: Array<{ name: string; count: number }>;
  tipos_detalle: Array<{ name: string; count: number }>;
  subestados: Array<{ name: string; count: number }>;
  country_codes: Array<{ name: string; count: number }>;
}

// Agent tool operation types
export type FalloOperation = "search" | "browse";

// Agent tool parameters
export interface FalloSearchParams {
  operation: FalloOperation;
  query?: string; // required for search operation
  filters?: FalloFilters;
  limit?: number;
  offset?: number;
  sortBy?: FalloSortBy;
  sortOrder?: FalloSortOrder;
}
