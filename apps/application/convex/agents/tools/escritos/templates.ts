/**
 * Templates for Escritos tools markdown responses
 * 
 * This file contains all the markdown templates used by escritos-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

/**
 * Template for listing escritos in a case
 */
export function createEscritosListTemplate(
  caseId: string,
  escritos: Array<{
    _id: string;
    title: string;
    status: string;
    _creationTime: number;
  }>
): string {
  return `# 📋 Lista de Escritos

## Caso
- **ID del Caso**: ${caseId}

## Escritos Encontrados
${escritos.map((escrito) => `- **ID del Escrito**: ${escrito._id} - **Título**: ${escrito.title} - **Estado**: ${escrito.status} - **Fecha de Creación**: ${new Date(escrito._creationTime).toLocaleDateString()}`).join("\n")}

## Información Adicional
- **Total de Escritos**: ${escritos.length}
- **Estados**: ${escritos.map((escrito) => escrito.status).join(", ")}
- **Fechas de Creación**: ${escritos.map((escrito) => new Date(escrito._creationTime).toLocaleDateString()).join(", ")}

---
*Listado de escritos del caso ${caseId}*`;
}

/**
 * Template for escrito statistics
 */
export function createEscritoStatsTemplate(
  escritoId: string,
  version: number,
  stats: {
    words: number;
    paragraphs: number;
  }
): string {
  return `# Estadísticas del Escrito

## Información del Documento
- **ID del Escrito**: ${escritoId}
- **Versión**: ${version}

## Estadísticas de Contenido
- **Cantidad de Palabras**: ${stats.words.toLocaleString()} palabras
- **Cantidad de Párrafos**: ${stats.paragraphs} párrafos

## Estructura del Documento
${stats.paragraphs === 1 ? 'Documento de un solo párrafo' : `${stats.paragraphs} párrafos`} con un promedio de ${stats.paragraphs > 0 ? Math.round(stats.words / stats.paragraphs) : 0} palabras por párrafo.`;
}

/**
 * Template for create escrito success message
 */
export function createEscritoCreateSuccessTemplate(
  title: string,
  caseId: string
): string {
  return `Escrito "${title}" listo para crear en el caso ${caseId}. Esto solo muestra la opción de crear el escrito al usuario, no lo crea.`;
}

/**
 * Template for escrito not found error
 */
export function createEscritoNotFoundTemplate(escritoId: string): string {
  return `Escrito con ID ${escritoId} no encontrado`;
}

/**
 * Template for invalid action error
 */
export function createInvalidActionTemplate(action: string): string {
  return `Acción no soportada: ${action}. Use 'create', o 'list'.`;
}

/**
 * Template for search results
 */
export function createEscritosSearchResultsTemplate(
  escritos: Array<{
    _id: string;
    title: string;
    status: string;
    _creationTime: number;
    lastEditedAt?: number;
  }>,
  query: string,
  limit?: number
): string {
  if (escritos.length === 0) {
    if (query.trim()) {
      return `# 🔍 Búsqueda de Escritos

## Término de Búsqueda
**Buscar**: "${query}"

## Resultados
No se encontraron escritos que coincidan con el término de búsqueda.

## Sugerencias
- Verifica la ortografía del término de búsqueda
- Intenta con un término más general
- Busca por título del escrito

---
*Búsqueda completada - 0 resultados*`;
    } else {
      return `# 📋 Lista de Escritos

## Resultados
No se encontraron escritos en este caso.

---
*Listado completado - 0 escritos*`;
    }
  }

  const isSearch = query.trim().length > 0;
  const title = isSearch ? "🔍 Búsqueda de Escritos" : "📋 Lista de Escritos";
  const searchSection = isSearch ? `## Término de Búsqueda
**Buscar**: "${query}"

` : "";

  let result = `${title}

${searchSection}## Resultados Encontrados
Se encontraron **${escritos.length}** escrito${escritos.length !== 1 ? 's' : ''}.

---

`;

  escritos.forEach((escrito, idx) => {
    const lastEdited = escrito.lastEditedAt 
      ? new Date(escrito.lastEditedAt).toLocaleDateString()
      : new Date(escrito._creationTime).toLocaleDateString();
    
    result += `## ${idx + 1}. ${escrito.title}
- **ID del Escrito**: ${escrito._id}
- **Estado**: ${escrito.status}
- **Última Edición**: ${lastEdited}
- **Fecha de Creación**: ${new Date(escrito._creationTime).toLocaleDateString()}
`;
    if (idx < escritos.length - 1) result += "\n---\n";
  });

  result += `\n---
## Resumen
- **Total de Resultados**: ${escritos.length}`;

  if (limit) {
    result += `\n- **Límite Aplicado**: ${limit}`;
  }

  if (isSearch) {
    result += `\n- **Filtro**: Búsqueda por término`;
  }

  return result;
}
