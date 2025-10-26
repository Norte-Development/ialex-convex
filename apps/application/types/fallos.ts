// Core types for fallos (jurisprudencia) data

export type EstadoFallo = 
  | "vigente" | "derogada" | "caduca" | "anulada" 
  | "suspendida" | "abrogada" | "sin_registro_oficial";

export type TipoContenidoFallo = 
  | "leg" | "jur" | "adm";

export type TipoGeneralFallo = string; // Dynamically loaded from MongoDB

// Main document interface matching MongoDB structure
export interface FalloDoc {
  _id?: string; // MongoDB ObjectId
  document_id: string; // normalized document identifier
  tipo_contenido: TipoContenidoFallo;
  tipo_general: TipoGeneralFallo;
  jurisdiccion: string; // nacional, provincial, municipal, etc.
  tribunal: string; // court name
  magistrados: string[]; // array of judge names
  actor: string; // plaintiff
  demandado: string; // defendant
  sala: string; // chamber
  titulo: string; // case title
  contenido: string; // full content
  fecha: string; // case date (ISO format)
  promulgacion: string; // promulgation date (ISO format)
  publicacion: string; // publication date (ISO format)
  sumario: string; // summary
  materia: string; // subject matter
  tags: string[]; // tags array
  referencias_normativas: string[]; // normative references
  citas: string[]; // citations
  estado: EstadoFallo;
  created_at?: string;
  updated_at?: string;
}

// Filter parameters for MongoDB queries
export interface FalloFilters {
  jurisdiccion?: string;
  tribunal?: string;
  materia?: string;
  estado?: EstadoFallo;
  fecha_from?: string; // ISO date string
  fecha_to?: string; // ISO date string
  promulgacion_from?: string; // ISO date string
  promulgacion_to?: string; // ISO date string
  publicacion_from?: string; // ISO date string
  publicacion_to?: string; // ISO date string
  actor?: string; // case-insensitive search
  demandado?: string; // case-insensitive search
  magistrados?: string; // case-insensitive search
  tags?: string[]; // array of tags to match
  search?: string; // text search in titulo, contenido, materia
  document_id?: string; // exact match
  tipo_contenido?: TipoContenidoFallo;
  tipo_general?: TipoGeneralFallo;
  sala?: string;
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
export type FalloSortBy = "fecha" | "promulgacion" | "publicacion" | "relevancia" | "created_at" | "updated_at";
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
    titulo: string;
    tribunal: string;
    jurisdiccion: string;
    fecha: string;
    promulgacion: string;
    actor: string;
    demandado: string;
    magistrados: string[];
    materia: string;
    tags: string[];
    sumario: string;
  };
}

// Chunk search result for document reading
export interface FalloChunkResult {
  document_id: string;
  chunk_index: number;
  text: string;
  score: number;
}

// Facets for filters UI
export interface FallosFacets {
  jurisdicciones: Record<string, number>;
  tribunales: Record<string, number>;
  materias: Record<string, number>;
  estados: Record<EstadoFallo, number>;
  tags: Record<string, number>;
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
