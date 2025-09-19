/**
 * Type definition for legislation search results from Qdrant
 */
export type LegislationSearchResult = {
  id: string; // Always present - either from payload or point ID
  country_code?: string;
  document_id?: string;
  fuente?: string;
  relaciones: (string | any)[];
  title?: string;
  index?: number;
  tipo_norma?: string;
  citas: (string | any)[];
  publication_ts?: number;
  text?: string;
  type?: string;
  url?: string;
  last_ingested_run_id?: string;
  number?: string;
  date_ts?: number;
  content_hash?: string;
  tipo_organismo?: string;
  jurisdiccion?: string;
  tipo_contenido?: string;
  sanction_ts?: number;
  tags: (string | any)[];
  estado?: string;
  score: number;
};
