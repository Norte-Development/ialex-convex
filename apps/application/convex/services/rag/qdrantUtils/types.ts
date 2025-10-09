/**
 * Type definition for legislation search results from Qdrant
 */
export type LegislationSearchResult = {
  id: string; // Always present - either from payload or point ID
  content_hash?: string;
  date_ts?: number;
  fuente?: string;
  tipo_contenido?: string;
  publication_ts?: number;
  text?: string;
  tags: (string | any)[];
  country_code?: string;
  title?: string;
  estado?: string;
  subestado?: string;
  tipo_general?: string;
  citas: (string | any)[];
  tipo_detalle?: string;
  index?: number;
  last_ingested_run_id?: string;
  relaciones: (string | any)[];
  jurisdiccion?: string;
  number?: string;
  document_id?: string;
  url?: string;
  sanction_ts?: number;
  // Legacy fields for backward compatibility
  tipo_norma?: string;
  type?: string;
  tipo_organismo?: string;
  score: number;
};
