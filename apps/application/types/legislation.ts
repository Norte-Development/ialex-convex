// Core types for legislation data
export type Estado = 
  | "vigente" | "derogada" | "caduca" | "anulada" 
  | "suspendida" | "abrogada" | "sin_registro_oficial";

export type Subestado = 
  | "alcance_general" | "individual_modificatoria_o_sin_eficacia"
  | "vetada" | "derogada" | "abrogada_implicita"
  | "ley_caduca" | "refundida_ley_caduca";

export type TipoRelacion = 
  | "modifica" | "es_modificada_por" | "deroga" | "es_derogada_por"
  | "adhiere" | "es_adherida_por" | "sustituye" | "es_sustituida_por"
  | "vinculada" | "es_vinculada_con" | "reglamenta" | "es_reglamentada_por"
  | "complementa" | "es_complementada_por" | "relacionada_con";

// New Paraguay-specific interfaces
export interface Articulo {
  articulo: number;
  texto: string;
  detalles_inmueble?: {
    ubicacion?: string;
    finca_matriz?: number;
    uso_destinado?: string;
    dimensiones?: {
      noreste?: string;
      sureste?: string;
      suroeste?: string;
      noroeste?: string;
    };
    superficie?: string;
    georreferencias?: {
      elipsoide?: string;
      zona?: string;
      meridiano_central?: number;
      vertices?: Array<{
        vertice: string;
        x: number;
        y: number;
      }>;
    };
  };
}

export interface Aprobacion {
  diputados?: string;
  senadores?: string;
  constitucional?: string;
}

export interface Dates {
  publication_date?: string;
  sanction_date?: string;
  indexed_at?: string;
}

// External data interfaces - Updated for Paraguay structure
export interface NormativeDoc {
  _id?: string; // MongoDB ObjectId
  document_id: string; // normalized document identifier
  type: string; // ley, decreto, resolucion, etc.
  country_code: string; // py, ar, etc.
  jurisdiccion: string; // nacional, departamental, municipal
  numero?: number; // law number
  title: string; // full title
  estado: Estado;
  fuente: string; // source (bacn, etc.)
  url?: string; // source URL
  content_hash?: string; // content hash for deduplication
  dates?: Dates;
  materia?: string; // subject matter
  articulos?: Articulo[]; // articles array
  aprobacion?: Aprobacion;
  tags?: string[]; // tags array
  subestado?: Subestado;
  texto?: string;
  content?: string;
  resumen?: string;
  relaciones?: Relacion[];
  created_at?: string;
  updated_at?: string;
}

export interface NormativeChunk {
  normative_id: string;
  chunk_index: number;
  article?: string;
  section?: string;
  text: string;
  vector_id?: string;
}

export interface Relacion {
  target_id: string;
  tipo: TipoRelacion;
  alcance?: "total" | "parcial";
  articulo?: string;
  desde?: string;
  hasta?: string;
  fuente_url?: string;
  fuente_cita?: string;
  confidence?: number;
  textual_cita?: string;
}

// Search interfaces
export interface CorpusSearchParams {
  query: string;
  type?: string;
  jurisdiccion?: string;
  estado?: Estado;
  sanction_date_from?: string;
  sanction_date_to?: string;
  vigencia_actual?: boolean;
  limit?: number;
}

export interface IntraDocSearchParams {
  query: string;
  normative_ids: string[];
  limit?: number;
}

export interface SearchResult {
  id: string; // document_id
  type: string;
  title: string;
  resumen?: string;
  score: number;
  jurisdiccion?: string;
  estado: Estado;
  sanction_date?: string;
  vigencia_actual?: boolean;
}

export interface ChunkSearchResult {
  normative_id: string;
  article?: string;
  section?: string;
  text: string;
  score: number;
  chunk_index: number;
}

// Filter interfaces for MongoDB queries
export interface NormativeFilters {
  type?: string;
  jurisdiccion?: string;
  estado?: Estado;
  sanction_date_from?: string;
  sanction_date_to?: string;
  publication_date_from?: string;
  publication_date_to?: string;
  number?: number;
  search?: string; // text search in title and content
  vigencia_actual?: boolean;
}

export interface ListNormativesParams {
  filters?: NormativeFilters;
  limit?: number;
  offset?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

// Sorting
export type SortBy = "sanction_date" | "updated_at" | "created_at" | "relevancia";
export type SortOrder = "asc" | "desc";

// Facets for filters UI
export interface NormativesFacets {
  types: Record<string, number>;
  jurisdicciones: Record<string, number>;
  estados: Record<Estado, number>;
}
