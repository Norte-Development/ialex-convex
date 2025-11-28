/**
 * Templates for Cases tools markdown responses
 * 
 * This file contains all the markdown templates used by cases-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

import { Id } from "../../../_generated/dataModel";

/**
 * Type definition for case results
 */
export type CaseResult = {
  _id: Id<"cases">;
  _creationTime: number;
  title: string;
  description?: string;
  expedientNumber?: string;
  assignedLawyer: Id<"users">;
  createdBy: Id<"users">;
  status: "pendiente" | "en progreso" | "completado" | "archivado" | "cancelado";
  priority: "low" | "medium" | "high";
  category?: string;
  estimatedHours?: number;
  startDate?: number;
  isArchived: boolean;
  accessLevel?: string;
  source?: string;
};

/**
 * Template for formatting individual case details
 */
export function formatCaseDetails(caseData: CaseResult): string {
  const statusLabels: Record<string, string> = {
    pendiente: "⏳ Pendiente",
    "en progreso": "🔄 En Progreso",
    completado: "✅ Completado",
    archivado: "📦 Archivado",
    cancelado: "❌ Cancelado",
  };

  const priorityLabels: Record<string, string> = {
    low: "🟢 Baja",
    medium: "🟡 Media",
    high: "🔴 Alta",
  };

  const statusLabel = statusLabels[caseData.status] || caseData.status;
  const priorityLabel = priorityLabels[caseData.priority] || caseData.priority;

  let details = `### ${caseData.title}
- **ID**: ${caseData._id}
- **Estado**: ${statusLabel}
- **Prioridad**: ${priorityLabel}`;

  if (caseData.expedientNumber) {
    details += `\n- **Número de Expediente**: ${caseData.expedientNumber}`;
  }

  if (caseData.description) {
    details += `\n- **Descripción**: ${caseData.description}`;
  }

  if (caseData.category) {
    details += `\n- **Categoría**: ${caseData.category}`;
  }

  if (caseData.estimatedHours) {
    details += `\n- **Horas Estimadas**: ${caseData.estimatedHours}`;
  }

  if (caseData.startDate) {
    const startDate = new Date(caseData.startDate);
    details += `\n- **Fecha de Inicio**: ${startDate.toLocaleDateString()}`;
  }

  if (caseData.accessLevel) {
    details += `\n- **Nivel de Acceso**: ${caseData.accessLevel}`;
  }

  return details;
}

/**
 * Template for search results
 */
export function createSearchResultsTemplate(
  cases: CaseResult[],
  limit?: number
): string {
  if (cases.length === 0) {
    return `# 🔍 Búsqueda de Casos

## Resultados
No se encontraron casos que coincidan con la búsqueda.

## Sugerencias
- Verifica los términos de búsqueda
- Intenta con términos más generales
- Asegúrate de tener acceso a los casos que buscas

---
*Búsqueda completada - 0 resultados*`;
  }

  let result = `# 🔍 Búsqueda de Casos

## Resultados Encontrados
Se encontraron **${cases.length}** caso${cases.length !== 1 ? 's' : ''}.

---

`;

  cases.forEach((caseData, idx) => {
    result += `\n## ${idx + 1}. ${formatCaseDetails(caseData)}\n`;
    if (idx < cases.length - 1) result += "\n---\n";
  });

  result += `\n---
## Resumen
- **Total de Resultados**: ${cases.length}`;

  if (limit) {
    result += `\n- **Límite Aplicado**: ${limit}`;
  }

  return result;
}

/**
 * Template for search results with search query
 */
export function createCasesResultsTemplate(
  cases: CaseResult[],
  query: string,
  limit?: number
): string {
  if (cases.length === 0) {
    return `# 🔍 Búsqueda de Casos

## Término de Búsqueda
**Buscar**: "${query}"

## Resultados
No se encontraron casos que coincidan con el término de búsqueda.

## Sugerencias
- Verifica la ortografía del término de búsqueda
- Intenta con un término más general
- Busca por título, descripción o número de expediente

---
*Búsqueda completada - 0 resultados*`;
  }

  let result = `# 🔍 Búsqueda de Casos

## Término de Búsqueda
**Buscar**: "${query}"

## Resultados Encontrados
Se encontraron **${cases.length}** caso${cases.length !== 1 ? 's' : ''}.

---

`;

  cases.forEach((caseData, idx) => {
    result += `\n## ${idx + 1}. ${formatCaseDetails(caseData)}\n`;
    if (idx < cases.length - 1) result += "\n---\n";
  });

  result += `\n---
## Resumen
- **Total de Resultados**: ${cases.length}`;

  if (limit) {
    result += `\n- **Límite Aplicado**: ${limit}`;
  }

  result += `\n- **Filtro**: Búsqueda por término`;

  return result;
}
