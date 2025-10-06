/**
 * Templates for Documents tools markdown responses
 * 
 * This file contains all the markdown templates used by documents-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

/**
 * Template for case documents search results
 */
export function createCaseDocumentsSearchTemplate(
  query: string,
  limit: number,
  contextWindow: number,
  results: string
): string {
  return `# 🔍 Búsqueda de Documentos del Caso

## Consulta
**Término de búsqueda**: "${query}"

## Configuración de Búsqueda
- **Límite de resultados**: ${limit}
- **Ventana de contexto**: ${contextWindow}

## Resultados
${results}
---
*Búsqueda semántica realizada en los documentos del caso.*`;
}

/**
 * Template for case documents search with no results
 */
export function createCaseDocumentsNoResultsTemplate(
  query: string,
  limit: number,
  contextWindow: number
): string {
  return `# 🔍 Búsqueda de Documentos del Caso

## Consulta
**Término de búsqueda**: "${query}"

## Configuración de Búsqueda
- **Límite de resultados**: ${limit}
- **Ventana de contexto**: ${contextWindow}

## Resultados
No se encontraron documentos relevantes para la consulta.

## Sugerencias
- Intenta con términos de búsqueda más generales
- Verifica la ortografía de los términos utilizados
- Considera usar sinónimos o términos relacionados

---
*Búsqueda semántica realizada en los documentos del caso.*`;
}
