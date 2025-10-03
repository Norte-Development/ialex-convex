import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for searching and retrieving client information.
 * Supports searching by name, DNI, CUIT, or filtering by case.
 *
 * @description Tool for searching and retrieving client information. Supports searching by name, DNI, CUIT, or filtering by case. Returns comprehensive client details including their cases and roles. Perfect for finding client information and understanding client-case relationships.
 * @param {Object} args - Search parameters
 * @param {string} [args.searchTerm] - Search term to filter clients by name, DNI, or CUIT
 * @param {string} [args.caseId] - Filter by case (returns clients in specific case)
 * @param {number} [args.limit=20] - Maximum number of results to return (default: 20, max: 100)
 * @returns {Promise<Object>} Search results with client details and their cases
 * @throws {Error} When user is not authenticated or search fails
 *
 * @example
 * // Search clients by name
 * await searchClientsTool.handler(ctx, {
 *   searchTerm: "Juan Pérez",
 *   limit: 10
 * });
 *
 * // Get clients in specific case
 * await searchClientsTool.handler(ctx, {
 *   caseId: "case_123",
 *   limit: 50
 * });
 */
export const searchClientsTool = createTool({
  description: "Tool for searching and retrieving client information. Supports searching by name, DNI, CUIT, or filtering by case. Returns comprehensive client details including their cases and roles. Perfect for finding client information and understanding client-case relationships.",
  args: z.object({
    searchTerm: z.any().optional().describe("Search term to filter clients by name, DNI, or CUIT"),
    caseId: z.any().optional().describe("Filter by case (returns clients in specific case)"),
    limit: z.any().optional().describe("Maximum number of results to return (default: 20, max: 100)")
  }).required({}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const searchTerm = args.searchTerm?.trim();
      const targetCaseId = args.caseId?.trim();
      const limitError = validateNumberParam(args.limit, "limit", 1, 100, 20);
      if (limitError) return limitError;
      const limit = args.limit !== undefined ? args.limit : 20;

      // TODO: Implement client search logic
      // This would search for clients using the provided parameters
      
      if (searchTerm) {
        return `# 🔍 Búsqueda de Clientes

## Término de Búsqueda
**Buscar**: "${searchTerm}"

## Resultados
*Funcionalidad de búsqueda de clientes - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total Encontrados**: Por implementar
- **Filtros Aplicados**: Término de búsqueda

## Próximos Pasos
1. Implementar búsqueda por nombre, DNI, y CUIT
2. Retornar detalles completos del cliente
3. Incluir información de casos asociados

---
*Funcionalidad de búsqueda de clientes - implementación pendiente*`;
      } else if (targetCaseId) {
        return `# 👥 Clientes del Caso

## Información del Caso
- **ID del Caso**: ${targetCaseId}

## Clientes Encontrados
*Funcionalidad de listado de clientes por caso - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Clientes**: Por implementar
- **Roles en el Caso**: Por implementar

## Próximos Pasos
1. Implementar consulta de clientes por caso
2. Incluir roles de cada cliente (demandante, demandado, etc.)
3. Retornar información completa del cliente

---
*Funcionalidad de clientes por caso - implementación pendiente*`;
      } else {
        return `# 📋 Todos los Clientes

## Búsqueda General
Sin filtros específicos aplicados.

## Resultados
*Funcionalidad de listado general de clientes - implementación pendiente*

## Información Adicional
- **Límite de Resultados**: ${limit}
- **Total de Clientes**: Por implementar
- **Clientes Activos**: Por implementar

## Próximos Pasos
1. Implementar listado paginado de todos los clientes
2. Incluir información básica del cliente
3. Mostrar casos asociados

---
*Funcionalidad de listado general de clientes - implementación pendiente*`;
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
