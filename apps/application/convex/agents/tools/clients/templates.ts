/**
 * Templates for Clients tools markdown responses
 *
 * This file contains all the markdown templates used by clients-related tools.
 * Templates are separated from tool logic to improve maintainability and reusability.
 */

import { Id } from "../../../_generated/dataModel";

/**
 * Type definition for client results (new juridical model)
 */
export type ClientResult = {
  _id: Id<"clients">;
  _creationTime: number;
  // Capa 1 - Naturaleza Jurídica
  naturalezaJuridica: "humana" | "juridica";
  // Campos Persona Humana
  nombre?: string;
  apellido?: string;
  dni?: string;
  actividadEconomica?: "sin_actividad" | "profesional" | "comerciante";
  profesionEspecifica?: string;
  // Campos Persona Jurídica
  razonSocial?: string;
  tipoPersonaJuridica?:
    | "sociedad"
    | "asociacion_civil"
    | "fundacion"
    | "cooperativa"
    | "ente_publico"
    | "consorcio"
    | "otro";
  tipoSociedad?:
    | "SA"
    | "SAS"
    | "SRL"
    | "COLECTIVA"
    | "COMANDITA_SIMPLE"
    | "COMANDITA_ACCIONES"
    | "CAPITAL_INDUSTRIA"
    | "IRREGULAR"
    | "HECHO"
    | "OTRO";
  descripcionOtro?: string;
  // Campos comunes
  cuit?: string;
  email?: string;
  phone?: string;
  domicilioLegal?: string;
  notes?: string;
  displayName: string;
  // Campos legado (deprecated)
  clientType?: "individual" | "company";
  name?: string;
  address?: string;
  // Sistema
  isActive: boolean;
  createdBy: Id<"users">;
  cases: Array<{
    caseId: Id<"cases">;
    caseTitle: string;
    caseStatus:
      | "pendiente"
      | "en progreso"
      | "completado"
      | "archivado"
      | "cancelado";
    role?: string;
    relationId: Id<"clientCases">;
  }>;
};

// Labels for display
const tipoPersonaJuridicaLabels: Record<string, string> = {
  sociedad: "Sociedad",
  asociacion_civil: "Asociación Civil",
  fundacion: "Fundación",
  cooperativa: "Cooperativa",
  ente_publico: "Ente Público",
  consorcio: "Consorcio",
  otro: "Otro",
};

const tipoSociedadLabels: Record<string, string> = {
  SA: "Sociedad Anónima (S.A.)",
  SAS: "Sociedad por Acciones Simplificada (S.A.S.)",
  SRL: "Sociedad de Responsabilidad Limitada (S.R.L.)",
  COLECTIVA: "Sociedad Colectiva",
  COMANDITA_SIMPLE: "Sociedad en Comandita Simple",
  COMANDITA_ACCIONES: "Sociedad en Comandita por Acciones",
  CAPITAL_INDUSTRIA: "Sociedad de Capital e Industria",
  IRREGULAR: "Sociedad Irregular ⚠️",
  HECHO: "Sociedad de Hecho ⚠️",
  OTRO: "Otro tipo societario",
};

const actividadEconomicaLabels: Record<string, string> = {
  sin_actividad: "Sin actividad económica",
  profesional: "Profesional",
  comerciante: "Comerciante",
};

/**
 * Template for formatting individual client details
 */
export function formatClientDetails(client: ClientResult): string {
  const isHumana = client.naturalezaJuridica === "humana";
  const typeLabel = isHumana ? "👤 Persona Humana" : "🏢 Persona Jurídica";

  let details = `### ${client.displayName} (${typeLabel})
- **ID**: ${client._id}
- **Naturaleza Jurídica**: ${isHumana ? "Persona Humana" : "Persona Jurídica"}`;

  if (isHumana) {
    // Persona Humana fields
    if (client.nombre) details += `\n- **Nombre**: ${client.nombre}`;
    if (client.apellido) details += `\n- **Apellido**: ${client.apellido}`;
    if (client.dni) details += `\n- **DNI**: ${client.dni}`;
    if (client.actividadEconomica) {
      details += `\n- **Actividad Económica**: ${actividadEconomicaLabels[client.actividadEconomica] || client.actividadEconomica}`;
    }
    if (client.profesionEspecifica)
      details += `\n- **Profesión**: ${client.profesionEspecifica}`;
  } else {
    // Persona Jurídica fields
    if (client.razonSocial)
      details += `\n- **Razón Social**: ${client.razonSocial}`;
    if (client.tipoPersonaJuridica) {
      details += `\n- **Tipo**: ${tipoPersonaJuridicaLabels[client.tipoPersonaJuridica] || client.tipoPersonaJuridica}`;
    }
    if (client.tipoSociedad) {
      details += `\n- **Tipo Societario**: ${tipoSociedadLabels[client.tipoSociedad] || client.tipoSociedad}`;
    }
    if (client.descripcionOtro)
      details += `\n- **Descripción**: ${client.descripcionOtro}`;
  }

  // Common fields
  if (client.cuit) details += `\n- **CUIT**: ${client.cuit}`;
  if (client.email) details += `\n- **Email**: ${client.email}`;
  if (client.phone) details += `\n- **Teléfono**: ${client.phone}`;
  if (client.domicilioLegal)
    details += `\n- **Domicilio Legal**: ${client.domicilioLegal}`;
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
  limit: number,
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
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? "s" : ""}.

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
  limit: number,
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
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? "s" : ""} asociado${clients.length !== 1 ? "s" : ""} a este caso.

---

`;

  clients.forEach((client, idx) => {
    // Find the role for this specific case
    const caseInfo = client.cases.find((c) => c.caseId === caseId);
    const role = caseInfo?.role || "No especificado";

    result += `\n## ${idx + 1}. ${client.displayName} - ${role}\n\n`;
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
  limit: number,
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
Se encontraron **${clients.length}** cliente${clients.length !== 1 ? "s" : ""} activo${clients.length !== 1 ? "s" : ""}.

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
