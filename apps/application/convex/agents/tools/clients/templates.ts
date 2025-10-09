/**
 * Templates for Clients tools markdown responses
 * 
 * This file contains all the markdown templates used by clients-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

import { Id } from "../../../_generated/dataModel";

/**
 * Type definition for client results
 */
export type ClientResult = {
  _id: Id<"clients">;
  _creationTime: number;
  name: string;
  email?: string;
  phone?: string;
  dni?: string;
  cuit?: string;
  address?: string;
  clientType: "individual" | "company";
  isActive: boolean;
  notes?: string;
  createdBy: Id<"users">;
  cases: Array<{
    caseId: Id<"cases">;
    caseTitle: string;
    caseStatus: "pendiente" | "en progreso" | "completado" | "archivado" | "cancelado";
    role?: string;
    relationId: Id<"clientCases">;
  }>;
};

/**
 * Template for formatting individual client details
 */
export function formatClientDetails(client: ClientResult): string {
  const typeLabel = client.clientType === "individual" ? "👤 Persona Física" : "🏢 Empresa";
  
  let details = `### ${client.name} (${typeLabel})
- **ID**: ${client._id}
- **Tipo**: ${client.clientType === "individual" ? "Persona Física" : "Empresa"}`;

  if (client.dni) details += `\n- **DNI**: ${client.dni}`;
  if (client.cuit) details += `\n- **CUIT**: ${client.cuit}`;
  if (client.email) details += `\n- **Email**: ${client.email}`;
  if (client.phone) details += `\n- **Teléfono**: ${client.phone}`;
  if (client.address) details += `\n- **Dirección**: ${client.address}`;
  if (client.notes) details += `\n- **Notas**: ${client.notes}`;

  if (client.cases.length > 0) {
    details += `\n\n**Casos Asociados** (${client.cases.length}):`;
    client.cases.forEach((caseInfo, idx) => {
      details += `\n  ${idx + 1}. **${caseInfo.caseTitle}**`;
      details += `\n     - Estado: ${caseInfo.caseStatus}`;
      if (caseInfo.role) details += `\n     - Rol: ${caseInfo.role}`;
      details += `\n     - ID Caso: ${caseInfo.caseId}`;
    });
  } else {
    details += `\n\n**Casos Asociados**: Ninguno`;
  }

  return details;
}

/**
 * Template for search results with search term
 */
export function createSearchResultsTemplate(
  clients: ClientResult[],
  searchTerm: string,
  limit: number
): string {
  if (clients.length === 0) {
    return `# 🔍 Búsqueda de Clientes

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados
No se encontraron clientes que coincidan con el término de búsqueda.

## Sugerencias
- Verifica la ortografía del término de búsqueda
- Intenta con un término más general
- Busca por DNI o CUIT si conoces estos datos

---
*Búsqueda completada - 0 resultados*`;
  }

  let result = `# 🔍 Búsqueda de Clientes

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados Encontrados
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? 's' : ''}.

---

`;

  clients.forEach((client, idx) => {
    result += `\n## ${idx + 1}. ${formatClientDetails(client)}\n`;
    if (idx < clients.length - 1) result += "\n---\n";
  });

  result += `\n---
## Resumen
- **Total de Resultados**: ${clients.length}
- **Límite Aplicado**: ${limit}
- **Filtro**: Búsqueda por término`;

  return result;
}

/**
 * Template for case clients results
 */
export function createCaseClientsResultsTemplate(
  clients: ClientResult[],
  caseId: string,
  limit: number
): string {
  if (clients.length === 0) {
    return `# 👥 Clientes del Caso

## Información del Caso
- **ID del Caso**: ${caseId}

## Resultados
No se encontraron clientes asociados a este caso.

## Información
Esto podría significar que:
- El caso aún no tiene clientes asignados
- Los clientes han sido desactivados
- El ID del caso es incorrecto

---
*Búsqueda completada - 0 clientes encontrados*`;
  }

  let result = `# 👥 Clientes del Caso

## Información del Caso
- **ID del Caso**: ${caseId}

## Clientes Encontrados
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? 's' : ''} asociado${clients.length !== 1 ? 's' : ''} a este caso.

---

`;

  clients.forEach((client, idx) => {
    // Find the role for this specific case
    const caseInfo = client.cases.find(c => c.caseId === caseId);
    const role = caseInfo?.role || "No especificado";
    
    result += `\n## ${idx + 1}. ${client.name} - ${role}\n\n`;
    result += formatClientDetails(client);
    if (idx < clients.length - 1) result += "\n\n---\n";
  });

  result += `\n\n---
## Resumen
- **Total de Clientes**: ${clients.length}
- **Límite Aplicado**: ${limit}
- **Filtro**: Clientes del caso específico`;

  return result;
}

/**
 * Template for all clients results
 */
export function createAllClientsResultsTemplate(
  clients: ClientResult[],
  limit: number
): string {
  if (clients.length === 0) {
    return `# 📋 Todos los Clientes

## Resultados
No hay clientes activos en el sistema.

## Información
Para comenzar a trabajar con clientes:
1. Crea un nuevo cliente desde el panel de clientes
2. Asigna el cliente a uno o más casos
3. Completa la información del cliente según sea necesario

---
*Búsqueda completada - 0 clientes encontrados*`;
  }

  let result = `# 📋 Todos los Clientes

## Listado General
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? 's' : ''} activo${clients.length !== 1 ? 's' : ''}.

---

`;

  clients.forEach((client, idx) => {
    result += `\n## ${idx + 1}. ${formatClientDetails(client)}\n`;
    if (idx < clients.length - 1) result += "\n---\n";
  });

  result += `\n---
## Resumen
- **Total de Clientes**: ${clients.length}
- **Límite Aplicado**: ${limit}
- **Filtro**: Sin filtros (todos los clientes activos)`;

  return result;
}
