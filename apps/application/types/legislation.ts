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

// External data interfaces
export interface NormativeDoc {
  id: string; // normalized clave
  tipo: string;
  numero?: string;
  titulo: string;
  provincia?: string;
  promulgacion?: string; // ISO date
  estado: Estado;
  subestado?: Subestado;
  vigencia_actual?: boolean;
  texto?: string;
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
  tipo?: string;
  provincia?: string;
  estado?: Estado;
  promulgacion_from?: string;
  promulgacion_to?: string;
  vigencia_actual?: boolean;
  limit?: number;
}

export interface IntraDocSearchParams {
  query: string;
  normative_ids: string[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  tipo: string;
  titulo: string;
  resumen?: string;
  score: number;
  provincia?: string;
  estado: Estado;
  promulgacion?: string;
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
  tipo?: string;
  provincia?: string;
  estado?: Estado;
  promulgacion_from?: string;
  promulgacion_to?: string;
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
export type SortBy = "promulgacion" | "updated_at" | "created_at" | "relevancia";
export type SortOrder = "asc" | "desc";

// Facets for filters UI
export interface NormativesFacets {
  tipos: Record<string, number>;
  provincias: Record<string, number>;
  estados: Record<Estado, number>;
}
