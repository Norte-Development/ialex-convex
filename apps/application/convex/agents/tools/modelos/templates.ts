/**
 * Templates for Modelos (Templates) tools markdown responses
 * 
 * This file contains all the markdown templates used by modelos-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

import { createContentSummary, generateTemplateSummary } from "../shared/sanitizeContent";

/**
 * Template for specific template details
 */
export function createSpecificTemplateTemplate(
  templateId: string,
  template: any
): string {
  const contentPreview = template.content 
    ? (template.content.length > 200 
        ? template.content.substring(0, 200) + "..." 
        : template.content)
    : "Sin contenido";
  
  return `# 📄 Plantilla Específica

## Información de la Plantilla
- **ID de la Plantilla**: ${templateId}
- **Nombre**: ${template.name}
- **Categoría**: ${template.category}
- **Tipo de Contenido**: ${template.content_type || 'No especificado'}
- **Pública**: ${template.isPublic ? 'Sí' : 'No'}
- **Usos**: ${template.usageCount}
- **Fecha de Creación**: ${new Date(template._creationTime).toLocaleDateString('es-ES')}

## Descripción
${template.description || 'Sin descripción disponible'}

## Vista Previa del Contenido
\`\`\`${template.content_type || 'text'}
${contentPreview}
\`\`\`

## Tags
${template.tags && template.tags.length > 0 ? template.tags.map((tag: string) => `- ${tag}`).join('\n') : 'Sin tags'}

## Estado
- **Activa**: ${template.isActive ? 'Sí' : 'No'}
- **Creada por**: ${template.createdBy === 'system' ? 'Sistema' : 'Usuario'}

---
*Plantilla específica obtenida exitosamente*`;
}

/**
 * Template for search results with no matches
 */
export function createSearchNoResultsTemplate(
  searchTerm: string,
  limit: number,
  category?: string,
  contentType?: string
): string {
  return `# 🔍 Búsqueda de Plantillas

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados
❌ **No se encontraron plantillas** que coincidan con el término de búsqueda.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: 0
- **Filtros Aplicados**: Término de búsqueda
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Sugerencias
1. Verifica la ortografía del término de búsqueda
2. Intenta con términos más generales
3. Usa filtros de categoría para refinar la búsqueda

---
*Búsqueda completada sin resultados*`;
}

/**
 * Template for search results with matches
 */
export function createSearchResultsTemplate(
  searchTerm: string,
  templates: any[],
  limit: number,
  isDone: boolean,
  category?: string,
  contentType?: string
): string {
  const templatesList = templates.map((template: any, index: number) => {
    return `${index + 1}. ${generateTemplateSummary(template)}`;
  }).join('\n\n');
  
  return `# 🔍 Búsqueda de Plantillas

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: ${templates.length}
- **Más resultados disponibles**: ${isDone ? 'No' : 'Sí'}
- **Filtros Aplicados**: Término de búsqueda
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Aplica filtros adicionales para refinar la búsqueda
3. Considera usar términos de búsqueda más específicos

---
*Búsqueda completada exitosamente*`;
}

/**
 * Template for filtered results with no matches
 */
export function createFilterNoResultsTemplate(
  limit: number,
  category?: string,
  contentType?: string
): string {
  return `# 📋 Plantillas Filtradas

## Filtros Aplicados
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Resultados
❌ **No se encontraron plantillas** que coincidan con los filtros aplicados.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: 0
- **Filtros Activos**: Categoría y/o tipo de contenido

## Sugerencias
1. Verifica que la categoría sea correcta
2. Intenta con un tipo de contenido diferente
3. Usa un término de búsqueda para refinar los resultados

---
*Filtrado completado sin resultados*`;
}

/**
 * Template for filtered results with matches
 */
export function createFilterResultsTemplate(
  templates: any[],
  limit: number,
  isDone: boolean,
  category?: string,
  contentType?: string
): string {
  const templatesList = templates.map((template: any, index: number) => {
    return `${index + 1}. ${generateTemplateSummary(template)}`;
  }).join('\n\n');
  
  return `# 📋 Plantillas Filtradas

## Filtros Aplicados
${category ? `- **Categoría**: ${category}` : ''}
${contentType ? `- **Tipo de Contenido**: ${contentType}` : ''}

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontradas**: ${templates.length}
- **Más resultados disponibles**: ${isDone ? 'No' : 'Sí'}
- **Filtros Activos**: Categoría y/o tipo de contenido

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Combina con términos de búsqueda para resultados más específicos
3. Explora otras categorías o tipos de contenido

---
*Filtrado completado exitosamente*`;
}

/**
 * Template for all templates with no results
 */
export function createAllTemplatesNoResultsTemplate(limit: number): string {
  return `# 📋 Todas las Plantillas

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados
❌ **No hay plantillas disponibles** en el sistema.

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Plantillas**: 0
- **Plantillas Públicas**: 0
- **Plantillas Privadas**: 0

## Sugerencias
1. Contacta al administrador para agregar plantillas al sistema
2. Crea tu primera plantilla personalizada
3. Verifica los permisos de acceso

---
*Listado general completado sin resultados*`;
}

/**
 * Template for all templates with results
 */
export function createAllTemplatesResultsTemplate(
  templates: any[],
  limit: number,
  isDone: boolean
): string {
  const publicCount = templates.filter((t: any) => t.isPublic).length;
  const privateCount = templates.filter((t: any) => !t.isPublic).length;
  
  const templatesList = templates.map((template: any, index: number) => {
    return `${index + 1}. ${generateTemplateSummary(template)}`;
  }).join('\n\n');
  
  return `# 📋 Todas las Plantillas

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados Encontrados
${templatesList}

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Plantillas**: ${templates.length}
- **Plantillas Públicas**: ${publicCount}
- **Plantillas Privadas**: ${privateCount}
- **Más resultados disponibles**: ${isDone ? 'No' : 'Sí'}

## Próximos Pasos
1. Usa el nombre de una plantilla para obtener más detalles
2. Aplica filtros por categoría o tipo de contenido
3. Usa términos de búsqueda para encontrar plantillas específicas

---
*Listado general completado exitosamente*`;
}

/**
 * Template for template not found error
 */
export function createTemplateNotFoundTemplate(templateId: string): string {
  return `Plantilla con ID "${templateId}" no encontrada`;
}
