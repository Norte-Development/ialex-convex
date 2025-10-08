/**
 * Templates for Legislation tools markdown responses
 * 
 * This file contains all the markdown templates used by legislation-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

import { LegislationSearchResult } from "../../services/rag/qdrantUtils/types";

/**
 * Template for legislation search results
 */
export function createLegislationSearchTemplate(
  query: string,
  results: LegislationSearchResult[]
): string {
  return `# 📜 Búsqueda de Legislación

## Consulta
**Término de búsqueda**: "${query}"

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tipo de búsqueda**: Híbrida (densa + dispersa)
- **Colecciones consultadas**: ialex_legislation_py
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}

## Resultados
${results.length === 0 ? 'No se encontraron documentos legislativos relevantes para la consulta.' : results.map((result: LegislationSearchResult, index: number) => `
### ${index + 1}. ${result.title || 'Sin título'}
- **ID del Documento**: ${result.document_id || 'N/A'}
- **Tipo General**: ${result.tipo_general || 'N/A'}
- **Tipo Detalle**: ${result.tipo_detalle || 'N/A'}
- **Jurisdicción**: ${result.jurisdiccion || 'N/A'}
- **Número**: ${result.number || 'N/A'}
- **Estado**: ${result.estado || 'N/A'}
- **Subestado**: ${result.subestado || 'N/A'}
- **Fuente**: ${result.fuente || 'N/A'}
- **Tipo de Contenido**: ${result.tipo_contenido || 'N/A'}
- **Puntuación de Relevancia**: ${result.score ? result.score.toFixed(3) : 'N/A'}
- **Fecha de Publicación**: ${result.publication_ts ? new Date(result.publication_ts * 1000).toLocaleDateString() : 'N/A'}
- **Fecha de Sanción**: ${result.sanction_ts ? new Date(result.sanction_ts * 1000).toLocaleDateString() : 'N/A'}
${result.url ? `- **URL**: ${result.url}` : ''}
${result.relaciones && result.relaciones.length > 0 ? `- **Relaciones**: ${result.relaciones.length} documento(s) relacionado(s)` : ''}
- **Contenido**: ${result.text || 'Sin contenido disponible'}
`).join('\n')}

---
*Búsqueda híbrida realizada en la base de datos legislativa.*`;
}

/**
 * Template for legislation search error
 */
export function createLegislationSearchErrorTemplate(errorMessage: string): string {
  return `Búsqueda de legislación falló: ${errorMessage}`;
}
