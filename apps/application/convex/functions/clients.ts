import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// ========================================
// CLIENT MANAGEMENT
// ========================================

/**
 * Normalizes text for flexible searching by:
 * - Removing accents/diacritics
 * - Converting to lowercase
 * - Trimming and normalizing whitespace
 */
function normalizeText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Checks if a normalized search term matches within a normalized target string.
 * Performs a fuzzy search that allows partial matches.
 */
function fuzzyMatch(
  target: string | undefined | null,
  search: string,
): boolean {
  if (!search) return true;
  if (!target) return false;

  const normalizedTarget = normalizeText(target);
  const normalizedSearch = normalizeText(search);

  // Simple partial match - contains the search term
  return normalizedTarget.includes(normalizedSearch);
}

/**
 * Helper function to get all case IDs that a user has access to.
 * Includes cases the user created, is assigned to, has team access to, or has explicit user permissions for.
 */
async function getAccessibleCaseIds(
  ctx: QueryCtx,
  userId: string,
): Promise<Set<string>> {
  const caseIds = new Set<string>();

  // 1. Cases the user created or is assigned to
  const ownedCases = await ctx.db
    .query("cases")
    .filter((q) =>
      q.or(
        q.eq(q.field("createdBy"), userId),
        q.eq(q.field("assignedLawyer"), userId),
      ),
    )
    .collect();
  ownedCases.forEach((c) => caseIds.add(c._id));

  // 2. Cases accessible through team membership
  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  const teamCaseAccess = await Promise.all(
    teamMemberships.map((membership) =>
      ctx.db
        .query("teamCaseAccess")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
    ),
  );
  teamCaseAccess.flat().forEach((access) => caseIds.add(access.caseId));

  // 3. Cases with explicit user permissions
  const userCaseAccess = await ctx.db
    .query("userCaseAccess")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
  userCaseAccess.forEach((access) => caseIds.add(access.caseId));

  return caseIds;
}

/**
 * Helper function to batch fetch client cases to avoid N+1 queries.
 * Fetches all client-case relationships and case data in batches.
 */
async function batchFetchClientCases(
  ctx: QueryCtx,
  clients: Array<Doc<"clients">>,
) {
  if (clients.length === 0) return [];

  // Batch fetch all client-case relationships for all clients
  const allRelations = await Promise.all(
    clients.map(async (client) => {
      const relations = await ctx.db
        .query("clientCases")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      return { clientId: client._id, relations };
    }),
  );

  // Collect all unique case IDs
  const caseIdsSet = new Set<string>();
  for (const { relations } of allRelations) {
    for (const relation of relations) {
      caseIdsSet.add(relation.caseId);
    }
  }

  // Batch fetch all case data
  const casesMap = new Map<string, Doc<"cases"> | null>();
  await Promise.all(
    Array.from(caseIdsSet).map(async (caseId) => {
      const caseData = (await ctx.db.get(caseId as any)) as Doc<"cases"> | null;
      casesMap.set(caseId, caseData);
    }),
  );

  // Assemble the result
  return clients.map((client) => {
    const clientRelations = allRelations.find((r) => r.clientId === client._id);
    const cases = (clientRelations?.relations || [])
      .map((relation) => ({
        case: casesMap.get(relation.caseId) || null,
        role: relation.role,
        relationId: relation._id,
      }))
      .filter(({ case: caseData }) => caseData !== null);

    return {
      ...client,
      cases,
    };
  });
}

/**
 * Creates a new client record using the juridical model (CCyCN + LGS).
 *
 * @param {Object} args - The function arguments
 * @param {"humana" | "juridica"} args.naturalezaJuridica - Legal nature of the client
 *
 * For Persona Humana (naturalezaJuridica = "humana"):
 * @param {string} args.nombre - First name
 * @param {string} args.apellido - Last name
 * @param {string} args.dni - DNI (required)
 * @param {"sin_actividad" | "profesional" | "comerciante"} args.actividadEconomica - Economic activity
 * @param {string} [args.cuit] - CUIT (required if actividadEconomica !== "sin_actividad")
 * @param {string} [args.profesionEspecifica] - Specific profession
 *
 * For Persona Jurídica (naturalezaJuridica = "juridica"):
 * @param {string} args.razonSocial - Company name
 * @param {string} args.cuit - CUIT (required)
 * @param {string} args.tipoPersonaJuridica - Type of legal entity
 * @param {string} [args.tipoSociedad] - Society type (if tipoPersonaJuridica = "sociedad")
 * @param {string} [args.descripcionOtro] - Description for "otro" types
 *
 * @returns {Promise<string>} The created client's document ID
 */
export const createClient = mutation({
  args: {
    // Capa 1 - Naturaleza Jurídica
    naturalezaJuridica: v.union(v.literal("humana"), v.literal("juridica")),

    // Campos Persona Humana
    nombre: v.optional(v.string()),
    apellido: v.optional(v.string()),
    dni: v.optional(v.string()),
    actividadEconomica: v.optional(
      v.union(
        v.literal("sin_actividad"),
        v.literal("profesional"),
        v.literal("comerciante"),
      ),
    ),
    profesionEspecifica: v.optional(v.string()),

    // Campos Persona Jurídica
    razonSocial: v.optional(v.string()),
    tipoPersonaJuridica: v.optional(
      v.union(
        v.literal("sociedad"),
        v.literal("asociacion_civil"),
        v.literal("fundacion"),
        v.literal("cooperativa"),
        v.literal("ente_publico"),
        v.literal("consorcio"),
        v.literal("otro"),
      ),
    ),
    tipoSociedad: v.optional(
      v.union(
        v.literal("SA"),
        v.literal("SAS"),
        v.literal("SRL"),
        v.literal("COLECTIVA"),
        v.literal("COMANDITA_SIMPLE"),
        v.literal("COMANDITA_ACCIONES"),
        v.literal("CAPITAL_INDUSTRIA"),
        v.literal("IRREGULAR"),
        v.literal("HECHO"),
        v.literal("OTRO"),
      ),
    ),
    descripcionOtro: v.optional(v.string()),

    // Campos comunes
    cuit: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    domicilioLegal: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validaciones según naturaleza jurídica
    let displayName: string;

    if (args.naturalezaJuridica === "humana") {
      if (!args.nombre?.trim()) {
        throw new Error("El nombre es requerido para personas humanas");
      }
      if (!args.apellido?.trim()) {
        throw new Error("El apellido es requerido para personas humanas");
      }
      if (!args.dni?.trim()) {
        throw new Error("El DNI es obligatorio para personas humanas");
      }
      if (!args.actividadEconomica) {
        throw new Error("La actividad económica es requerida");
      }
      if (args.actividadEconomica !== "sin_actividad" && !args.cuit?.trim()) {
        throw new Error(
          "El CUIT es obligatorio para profesionales y comerciantes",
        );
      }

      displayName = `${args.apellido.trim()}, ${args.nombre.trim()}`;
    } else {
      if (!args.razonSocial?.trim()) {
        throw new Error("La razón social es requerida para personas jurídicas");
      }
      if (!args.cuit?.trim()) {
        throw new Error("El CUIT es obligatorio para personas jurídicas");
      }
      if (!args.tipoPersonaJuridica) {
        throw new Error("El tipo de persona jurídica es requerido");
      }
      if (args.tipoPersonaJuridica === "sociedad" && !args.tipoSociedad) {
        throw new Error("El tipo de sociedad es requerido");
      }
      if (
        (args.tipoPersonaJuridica === "otro" || args.tipoSociedad === "OTRO") &&
        !args.descripcionOtro?.trim()
      ) {
        throw new Error("La descripción es requerida para tipos no listados");
      }

      displayName = args.razonSocial.trim();
    }

    const clientId = await ctx.db.insert("clients", {
      naturalezaJuridica: args.naturalezaJuridica,
      nombre: args.nombre,
      apellido: args.apellido,
      dni: args.dni,
      actividadEconomica: args.actividadEconomica,
      profesionEspecifica: args.profesionEspecifica,
      razonSocial: args.razonSocial,
      tipoPersonaJuridica: args.tipoPersonaJuridica,
      tipoSociedad: args.tipoSociedad,
      descripcionOtro: args.descripcionOtro,
      cuit: args.cuit,
      email: args.email,
      phone: args.phone,
      domicilioLegal: args.domicilioLegal,
      notes: args.notes,
      displayName,
      isActive: true,
      createdBy: currentUser._id,
    });

    console.log("Created client with id:", clientId);
    return clientId;
  },
});

/**
 * Retrieves active clients with optional search filtering and pagination, including their associated cases.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.search] - Search term to filter clients by name, DNI, or CUIT (disables pagination)
 * @param {string} [args.paginationOpts.cursor] - Cursor for pagination (ignored when searching)
 * @param {number} [args.paginationOpts.numItems] - Number of items per page (default: 10, max: 100, ignored when searching)
 * @returns {Promise<Object>} Paginated result with clients array and pagination info, or all results when searching
 * @throws {Error} When not authenticated
 *
 * @description This function returns active clients in the system with their associated cases.
 * When searching, pagination is disabled and all matching results are returned.
 * When not searching, results are paginated using Convex's built-in pagination.
 * Only active clients and active case relationships are returned. Each client object includes
 * a 'cases' array containing the full case data and the client's role in each case.
 *
 * @example
 * ```javascript
 * // Get first page of clients with pagination
 * const firstPage = await getClients({
 *   paginationOpts: { numItems: 10 }
 * });
 * // Returns: {
 * //   page: [{
 * //     _id: "client_id",
 * //     name: "Client Name",
 * //     ...otherClientFields,
 * //     cases: [{
 * //       case: { _id: "case_id", title: "Case Title", ... },
 * //       role: "plaintiff"
 * //     }]
 * //   }],
 * //   isDone: false,
 * //   continueCursor: "cursor_string"
 * // }
 *
 * // Search returns all matching results (no pagination)
 * const searchResults = await getClients({ search: "juan" });
 * // Returns: {
 * //   page: [...all matching clients...],
 * //   isDone: true,
 * //   continueCursor: undefined
 * // }
 * ```
 */
/**
 * Helper function to compute displayName for legacy clients.
 * Used to ensure all returned clients have a displayName even if not in DB.
 */
function computeDisplayName(client: Doc<"clients">): string {
  // If displayName exists, use it
  if (client.displayName) return client.displayName;

  // For new model clients without displayName (shouldn't happen but just in case)
  if (
    client.naturalezaJuridica === "humana" &&
    client.apellido &&
    client.nombre
  ) {
    return `${client.apellido}, ${client.nombre}`;
  }
  if (client.naturalezaJuridica === "juridica" && client.razonSocial) {
    return client.razonSocial;
  }

  // For legacy clients, use the old name field
  if ((client as any).name) {
    return (client as any).name;
  }

  // Last resort fallback
  return "Sin nombre";
}

/**
 * Normalizes a client document to ensure it has all required fields for the API.
 * Computes displayName and naturalezaJuridica for legacy clients.
 */
function normalizeClient<T extends Doc<"clients">>(
  client: T,
): T & { displayName: string; naturalezaJuridica: "humana" | "juridica" } {
  return {
    ...client,
    displayName: computeDisplayName(client),
    naturalezaJuridica:
      client.naturalezaJuridica ||
      ((client as any).clientType === "company" ? "juridica" : "humana"),
  };
}

// Validator reutilizable para el cliente con nuevo modelo jurídico
// displayName es string porque siempre lo calculamos en el handler
const clientValidator = v.object({
  _id: v.id("clients"),
  _creationTime: v.number(),
  // Capa 1 - Naturaleza Jurídica
  naturalezaJuridica: v.union(v.literal("humana"), v.literal("juridica")),
  // Campos Persona Humana
  nombre: v.optional(v.string()),
  apellido: v.optional(v.string()),
  dni: v.optional(v.string()),
  actividadEconomica: v.optional(
    v.union(
      v.literal("sin_actividad"),
      v.literal("profesional"),
      v.literal("comerciante"),
    ),
  ),
  profesionEspecifica: v.optional(v.string()),
  // Campos Persona Jurídica
  razonSocial: v.optional(v.string()),
  tipoPersonaJuridica: v.optional(
    v.union(
      v.literal("sociedad"),
      v.literal("asociacion_civil"),
      v.literal("fundacion"),
      v.literal("cooperativa"),
      v.literal("ente_publico"),
      v.literal("consorcio"),
      v.literal("otro"),
    ),
  ),
  tipoSociedad: v.optional(
    v.union(
      v.literal("SA"),
      v.literal("SAS"),
      v.literal("SRL"),
      v.literal("COLECTIVA"),
      v.literal("COMANDITA_SIMPLE"),
      v.literal("COMANDITA_ACCIONES"),
      v.literal("CAPITAL_INDUSTRIA"),
      v.literal("IRREGULAR"),
      v.literal("HECHO"),
      v.literal("OTRO"),
    ),
  ),
  descripcionOtro: v.optional(v.string()),
  // Campos comunes
  cuit: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  domicilioLegal: v.optional(v.string()),
  notes: v.optional(v.string()),
  displayName: v.string(),
  // Campos legado (ya no funca esto)
  clientType: v.optional(
    v.union(v.literal("individual"), v.literal("company")),
  ),
  name: v.optional(v.string()),
  address: v.optional(v.string()),
  // Sistema
  isActive: v.boolean(),
  createdBy: v.id("users"),
});

// Validator para casos asociados
const clientCaseValidator = v.object({
  case: v.union(
    v.object({
      _id: v.id("cases"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("pendiente"),
        v.literal("en progreso"),
        v.literal("completado"),
        v.literal("archivado"),
        v.literal("cancelado"),
      ),
      category: v.optional(v.string()),
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
      ),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      assignedLawyer: v.id("users"),
      createdBy: v.id("users"),
      isArchived: v.boolean(),
      tags: v.optional(v.array(v.string())),
      estimatedHours: v.optional(v.number()),
      actualHours: v.optional(v.number()),
      expedientNumber: v.optional(v.string()),
      lastActivityAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  role: v.optional(v.string()),
  relationId: v.id("clientCases"),
});

export const getClients = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
    search: v.optional(v.string()),
    naturalezaJuridica: v.optional(
      v.union(v.literal("humana"), v.literal("juridica")),
    ),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        ...clientValidator.fields,
        cases: v.array(clientCaseValidator),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Require authentication to view clients
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get all cases the user has access to
    const accessibleCaseIds = await getAccessibleCaseIds(ctx, currentUser._id);

    // Get all clients associated with accessible cases
    const accessibleClientIds = new Set<string>();
    const clientCaseRelations = await ctx.db
      .query("clientCases")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const relation of clientCaseRelations) {
      if (accessibleCaseIds.has(relation.caseId)) {
        accessibleClientIds.add(relation.clientId);
      }
    }

    // ALSO include clients created by the current user (even if not associated with cases)
    const clientsCreatedByUser = await ctx.db
      .query("clients")
      .withIndex("by_created_by", (q) => q.eq("createdBy", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    clientsCreatedByUser.forEach((client) =>
      accessibleClientIds.add(client._id),
    );

    // Get all active clients
    let allClients = await ctx.db
      .query("clients")
      .withIndex("by_active_status", (q) => q.eq("isActive", true))
      .collect();

    // If searching, apply fuzzy search filter
    if (args.search && args.search.trim() !== "") {
      const searchTerm = args.search.trim();

      // Get all cases for searching in case titles and expedient numbers
      const allCases = await ctx.db.query("cases").collect();
      const casesMap = new Map(allCases.map((c) => [c._id, c]));

      // Get all client-case relations to match clients by their cases
      const allClientCaseRelations = await ctx.db
        .query("clientCases")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      // Create a map of clientId -> array of case objects
      const clientCasesMap = new Map<string, Doc<"cases">[]>();
      for (const relation of allClientCaseRelations) {
        const caseData = casesMap.get(relation.caseId);
        if (caseData) {
          if (!clientCasesMap.has(relation.clientId)) {
            clientCasesMap.set(relation.clientId, []);
          }
          clientCasesMap.get(relation.clientId)!.push(caseData);
        }
      }

      // Apply fuzzy matching filter
      allClients = allClients.filter((client) => {
        // Search in displayName (nombre completo o razón social)
        if (fuzzyMatch(client.displayName, searchTerm)) return true;

        // Search in nombre y apellido (persona humana)
        if (fuzzyMatch(client.nombre, searchTerm)) return true;
        if (fuzzyMatch(client.apellido, searchTerm)) return true;

        // Search in razón social (persona jurídica)
        if (fuzzyMatch(client.razonSocial, searchTerm)) return true;

        // Search in DNI (normalize by removing common separators)
        if (client.dni) {
          const normalizedDni = client.dni.replace(/[-.\s]/g, "");
          const normalizedSearchDni = searchTerm.replace(/[-.\s]/g, "");
          if (normalizedDni.includes(normalizedSearchDni)) return true;
        }

        // Search in CUIT (normalize by removing common separators)
        if (client.cuit) {
          const normalizedCuit = client.cuit.replace(/[-.\s]/g, "");
          const normalizedSearchCuit = searchTerm.replace(/[-.\s]/g, "");
          if (normalizedCuit.includes(normalizedSearchCuit)) return true;
        }

        // Search in email
        if (fuzzyMatch(client.email, searchTerm)) return true;

        // Search in phone (normalize by removing common separators)
        if (client.phone) {
          const normalizedPhone = client.phone.replace(/[-.()\s]/g, "");
          const normalizedSearchPhone = searchTerm.replace(/[-.()\s]/g, "");
          if (normalizedPhone.includes(normalizedSearchPhone)) return true;
        }

        // Search in associated case titles and expedient numbers
        const clientCases = clientCasesMap.get(client._id) || [];
        for (const caseData of clientCases) {
          if (fuzzyMatch(caseData.title, searchTerm)) return true;
          if (
            caseData.expedientNumber &&
            fuzzyMatch(caseData.expedientNumber, searchTerm)
          )
            return true;
        }

        return false;
      });
    }

    // Filter by accessible clients
    let filteredClients = allClients.filter((c) =>
      accessibleClientIds.has(c._id),
    );

    // Apply naturaleza jurídica filter
    if (args.naturalezaJuridica) {
      filteredClients = filteredClients.filter(
        (c) => c.naturalezaJuridica === args.naturalezaJuridica,
      );
    }

    // Apply sorting
    if (args.sortBy && args.sortOrder) {
      filteredClients.sort((a, b) => {
        let aValue, bValue;

        switch (args.sortBy) {
          case "name":
          case "displayName":
            aValue = computeDisplayName(a).toLowerCase();
            bValue = computeDisplayName(b).toLowerCase();
            break;
          case "naturalezaJuridica":
            aValue = a.naturalezaJuridica;
            bValue = b.naturalezaJuridica;
            break;
          case "createdAt":
          default:
            aValue = a._creationTime;
            bValue = b._creationTime;
            break;
        }
        if (aValue == null) aValue = "";
        if (bValue == null) bValue = "";
        if (aValue < bValue) return args.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return args.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const numItems = args.paginationOpts?.numItems ?? 10;
    const offset = args.paginationOpts?.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;
    const startIndex = offset;
    const endIndex = offset + numItems;

    const paginatedClients = filteredClients.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredClients.length;
    const continueCursor = isDone ? null : endIndex.toString();

    // Batch fetch related data to avoid N+1 queries
    const clientsWithCases = await batchFetchClientCases(ctx, paginatedClients);

    // Normalize clients to ensure displayName and naturalezaJuridica are present
    const normalizedClients = clientsWithCases.map((clientWithCases) => ({
      ...normalizeClient(clientWithCases),
      cases: clientWithCases.cases,
    }));

    return {
      page: normalizedClients,
      isDone,
      continueCursor,
      totalCount: filteredClients.length,
    };
  },
});

/**
 * Retrieves a single active client by ID, including related active cases and the client's role in each.
 *
 * @param {Object} args - The function arguments
 * @param {import("../_generated/dataModel").Id<"clients">} args.clientId - The client document ID
 * @returns {Promise<(Omit<any, "cases"> & { cases: Array<{ case: any; role: string; relationId: string }> }) | null>} The client with related cases, or null if not found/inactive
 * @throws {Error} When not authenticated
 *
 * @example
 * ```ts
 * const client = await getClientById({ clientId });
 * if (client) {
 *   console.log(client.name, client.cases.length);
 * }
 * ```
 */
export const getClientById = query({
  args: { clientId: v.id("clients") },
  returns: v.union(
    v.object({
      ...clientValidator.fields,
      cases: v.array(clientCaseValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.isActive === false) return null;

    // Check if user created this client OR has access via cases
    const userCreatedClient = client.createdBy === currentUser._id;

    if (!userCreatedClient) {
      // Check if user has access to this client via their accessible cases
      const accessibleCaseIds = await getAccessibleCaseIds(
        ctx,
        currentUser._id,
      );

      // Check if this client is associated with any accessible cases
      const clientCaseRelations = await ctx.db
        .query("clientCases")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const hasAccess = clientCaseRelations.some((relation) =>
        accessibleCaseIds.has(relation.caseId),
      );

      if (!hasAccess) {
        return null; // User doesn't have access to this client
      }
    }

    // Use batch fetching for single client as well for consistency
    const [clientWithCases] = await batchFetchClientCases(ctx, [client]);

    // Normalize to ensure displayName and naturalezaJuridica are present
    return {
      ...normalizeClient(clientWithCases),
      cases: clientWithCases.cases,
    };
  },
});

/**
 * Updates editable fields of a client document.
 *
 * Maintains consistency between `clientType` and identification fields:
 * - When `clientType` changes to "individual", `dni` is kept and `cuit` is automatically cleared.
 * - When `clientType` changes to "company", `cuit` is kept and `dni` is automatically cleared.
 * - When `clientType` is not changing, only explicitly empty identification fields are cleared.
 *
 * @param {Object} args - The function arguments
 * @param {import("../_generated/dataModel").Id<"clients">} args.clientId - The client document ID to update
 * @param {string} [args.name] - The client's name
 * @param {string} [args.email] - The client's email
 * @param {string} [args.phone] - The client's phone
 * @param {string} [args.dni] - DNI when clientType is "individual"
 * @param {string} [args.cuit] - CUIT when clientType is "company"
 * @param {string} [args.address] - Physical address
 * @param {"individual"|"company"} [args.clientType] - Client type
 * @param {string} [args.notes] - Additional notes
 * @param {boolean} [args.isActive] - Active flag (soft delete uses this separately)
 * @returns {Promise<import("../_generated/dataModel").Id<"clients">>} The updated client's ID
 * @throws {Error} When not authenticated
 *
 * @example
 * ```ts
 * await updateClient({
 *   clientId,
 *   name: "Nuevo Nombre",
 *   clientType: "company",
 *   cuit: "20-12345678-9",
 * });
 * ```
 */
export const updateClient = mutation({
  args: {
    clientId: v.id("clients"),
    // Campos Persona Humana
    nombre: v.optional(v.string()),
    apellido: v.optional(v.string()),
    dni: v.optional(v.string()),
    actividadEconomica: v.optional(
      v.union(
        v.literal("sin_actividad"),
        v.literal("profesional"),
        v.literal("comerciante"),
      ),
    ),
    profesionEspecifica: v.optional(v.string()),
    // Campos Persona Jurídica
    razonSocial: v.optional(v.string()),
    tipoPersonaJuridica: v.optional(
      v.union(
        v.literal("sociedad"),
        v.literal("asociacion_civil"),
        v.literal("fundacion"),
        v.literal("cooperativa"),
        v.literal("ente_publico"),
        v.literal("consorcio"),
        v.literal("otro"),
      ),
    ),
    tipoSociedad: v.optional(
      v.union(
        v.literal("SA"),
        v.literal("SAS"),
        v.literal("SRL"),
        v.literal("COLECTIVA"),
        v.literal("COMANDITA_SIMPLE"),
        v.literal("COMANDITA_ACCIONES"),
        v.literal("CAPITAL_INDUSTRIA"),
        v.literal("IRREGULAR"),
        v.literal("HECHO"),
        v.literal("OTRO"),
      ),
    ),
    descripcionOtro: v.optional(v.string()),
    // Campos comunes
    cuit: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    domicilioLegal: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const { clientId, ...patch } = args;

    // Get current client data
    const currentClient = await ctx.db.get(clientId);
    if (!currentClient) {
      throw new Error("Client not found");
    }

    // Check if user created this client OR has access via cases
    const userCreatedClient = currentClient.createdBy === currentUser._id;

    if (!userCreatedClient) {
      // Check if user has access to this client via their accessible cases
      const accessibleCaseIds = await getAccessibleCaseIds(
        ctx,
        currentUser._id,
      );

      const clientCaseRelations = await ctx.db
        .query("clientCases")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      const hasAccess = clientCaseRelations.some((relation) =>
        accessibleCaseIds.has(relation.caseId),
      );

      if (!hasAccess) {
        throw new Error("You don't have permission to update this client");
      }
    }

    // Recalcular displayName si se actualizan campos relevantes
    let displayName = currentClient.displayName;
    if (currentClient.naturalezaJuridica === "humana") {
      const nombre = patch.nombre ?? currentClient.nombre;
      const apellido = patch.apellido ?? currentClient.apellido;
      if (nombre && apellido) {
        displayName = `${apellido.trim()}, ${nombre.trim()}`;
      }
    } else {
      const razonSocial = patch.razonSocial ?? currentClient.razonSocial;
      if (razonSocial) {
        displayName = razonSocial.trim();
      }
    }

    await ctx.db.patch(clientId, { ...patch, displayName } as any);
    return clientId;
  },
});

/**
 * Soft-deletes a client by setting `isActive` to false and deactivates all active client-case relations.
 *
 * @param {Object} args - The function arguments
 * @param {import("../_generated/dataModel").Id<"clients">} args.clientId - The client ID to soft delete
 * @returns {Promise<{ readonly ok: true }>} Result object indicating success
 * @throws {Error} When not authenticated
 *
 * @example
 * ```ts
 * const res = await deleteClient({ clientId });
 * console.log(res.ok); // true
 * ```
 */
export const deleteClient = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Check if client exists
    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    // Check if user created this client OR has access via cases
    const userCreatedClient = client.createdBy === currentUser._id;

    const clientCaseRelations = await ctx.db
      .query("clientCases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (!userCreatedClient) {
      // Check if user has access to this client via their accessible cases
      const accessibleCaseIds = await getAccessibleCaseIds(
        ctx,
        currentUser._id,
      );

      const hasAccess = clientCaseRelations.some((relation) =>
        accessibleCaseIds.has(relation.caseId),
      );

      if (!hasAccess) {
        throw new Error("You don't have permission to delete this client");
      }
    }

    // Soft delete client
    await ctx.db.patch(args.clientId, { isActive: false } as any);

    // Deactivate relations
    await Promise.all(
      clientCaseRelations.map((rel) =>
        ctx.db.patch(rel._id, { isActive: false } as any),
      ),
    );

    return { ok: true } as const;
  },
});

/**
 * Internal query for agent tools to search clients.
 * Supports searching by name, DNI, CUIT, or filtering by case.
 *
 * @param {Object} args - Search parameters
 * @param {string} [args.searchTerm] - Search term to filter clients by name, DNI, or CUIT
 * @param {Id<"cases">} [args.caseId] - Filter by case (returns clients in specific case)
 * @param {number} [args.limit=20] - Maximum number of results to return (default: 20, max: 100)
 * @returns {Promise<Array>} Array of clients with their associated cases
 * @internal This is an internal query used by agent tools
 */
export const searchClientsForAgent = internalQuery({
  args: {
    searchTerm: v.optional(v.string()),
    caseId: v.id("cases"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      ...clientValidator.fields,
      cases: v.array(
        v.object({
          caseId: v.id("cases"),
          caseTitle: v.string(),
          caseStatus: v.union(
            v.literal("pendiente"),
            v.literal("en progreso"),
            v.literal("completado"),
            v.literal("archivado"),
            v.literal("cancelado"),
          ),
          role: v.optional(v.string()),
          relationId: v.id("clientCases"),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    let clients: Array<Doc<"clients">> = [];
    const caseId = args.caseId;

    if (caseId) {
      // Filter by case: get all active client-case relationships for this case
      const clientCaseRelations = await ctx.db
        .query("clientCases")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      // Batch fetch client data
      const clientsData = await Promise.all(
        clientCaseRelations.map(async (relation) => {
          const client = await ctx.db.get(relation.clientId);
          return client && client.isActive ? client : null;
        }),
      );

      // Filter out null values and apply limit
      clients = clientsData
        .filter((c): c is Doc<"clients"> => c !== null)
        .slice(0, limit);
    } else if (args.searchTerm) {
      // Use search index for displayName search
      const searchResults = await ctx.db
        .query("clients")
        .withSearchIndex("search_clients", (q) =>
          q.search("displayName", args.searchTerm!).eq("isActive", true),
        )
        .take(limit);

      // Also search by DNI/CUIT
      const dniCuitResults = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .filter((q) =>
          q.or(
            q.eq(q.field("dni"), args.searchTerm!),
            q.eq(q.field("cuit"), args.searchTerm!),
          ),
        )
        .take(limit);

      // Merge and deduplicate, then apply limit
      const allResults = [...searchResults];
      const existingIds = new Set(searchResults.map((c) => c._id));
      for (const result of dniCuitResults) {
        if (!existingIds.has(result._id)) {
          allResults.push(result);
        }
      }
      clients = allResults.slice(0, limit);
    } else {
      // No filters: get all active clients with consistent limit
      clients = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .take(limit);
    }

    // Use batch fetching to get cases for all clients
    const clientsWithBasicCases = await batchFetchClientCases(ctx, clients);

    // Transform to the format expected by the agent, normalizing legacy clients
    return clientsWithBasicCases.map((client) => ({
      ...normalizeClient(client),
      cases: client.cases.map(({ case: caseData, role, relationId }) => ({
        caseId: caseData!._id,
        caseTitle: caseData!.title,
        caseStatus: caseData!.status,
        role,
        relationId,
      })),
    }));
  },
});

// ========================================
// MIGRATION FUNCTIONS
// ========================================

/**
 * Migrates legacy clients (with clientType/name/address) to the new juridical model.
 * This should be run ONCE after deploying the new schema.
 *
 * Migration rules:
 * - clientType: "individual" → naturalezaJuridica: "humana"
 * - clientType: "company" → naturalezaJuridica: "juridica"
 * - name → displayName (and split into nombre/apellido for individuals, or razonSocial for companies)
 * - address → domicilioLegal
 *
 * @returns Summary of migrated clients
 */
export const migrateClientsToJuridicalModel = mutation({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only report what would be migrated
  },
  handler: async (ctx, args) => {
    // Get all clients
    const allClients = await ctx.db.query("clients").collect();

    const results = {
      total: allClients.length,
      alreadyMigrated: 0,
      needsMigration: 0,
      migrated: 0,
      errors: [] as Array<{ clientId: string; error: string }>,
    };

    for (const client of allClients) {
      // Check if client already has new model fields
      if (client.naturalezaJuridica && client.displayName) {
        results.alreadyMigrated++;
        continue;
      }

      results.needsMigration++;

      // Skip actual migration if dry run
      if (args.dryRun) {
        continue;
      }

      try {
        // Determine naturaleza jurídica from legacy clientType
        const legacyClientType = (client as any).clientType;
        const legacyName = (client as any).name || "";
        const legacyAddress = (client as any).address;

        let updateData: Record<string, any> = {
          domicilioLegal: legacyAddress || client.domicilioLegal,
        };

        if (legacyClientType === "company") {
          // Persona Jurídica
          updateData.naturalezaJuridica = "juridica";
          updateData.razonSocial = legacyName;
          updateData.displayName = legacyName || "Sin nombre";
          // Default to "otro" since we don't know the exact type
          updateData.tipoPersonaJuridica = client.tipoPersonaJuridica || "otro";
          updateData.descripcionOtro =
            client.descripcionOtro || "Migrado del sistema anterior";
        } else {
          // Persona Humana (default for "individual" or unknown)
          updateData.naturalezaJuridica = "humana";

          // Try to split name into nombre/apellido
          const nameParts = legacyName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            // Assume last part is apellido, rest is nombre
            updateData.apellido = nameParts.pop();
            updateData.nombre = nameParts.join(" ");
          } else {
            // Single word name
            updateData.nombre = legacyName || "Sin nombre";
            updateData.apellido = "-";
          }

          // Create displayName in "Apellido, Nombre" format
          updateData.displayName = `${updateData.apellido}, ${updateData.nombre}`;

          // Keep existing DNI, default activity
          updateData.actividadEconomica =
            client.actividadEconomica || "sin_actividad";
        }

        await ctx.db.patch(client._id, updateData);
        results.migrated++;
      } catch (error) {
        results.errors.push({
          clientId: client._id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("Migration results:", results);
    return results;
  },
});

/**
 * Gets migration status - how many clients need migration
 */
export const getMigrationStatus = query({
  args: {},
  returns: v.object({
    total: v.number(),
    alreadyMigrated: v.number(),
    needsMigration: v.number(),
    sampleLegacyClients: v.array(
      v.object({
        _id: v.id("clients"),
        name: v.optional(v.string()),
        clientType: v.optional(
          v.union(v.literal("individual"), v.literal("company")),
        ),
        hasNewModel: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    // await getCurrentUserFromAuth(ctx);

    const allClients = await ctx.db.query("clients").collect();

    let alreadyMigrated = 0;
    let needsMigration = 0;
    const sampleLegacyClients: Array<{
      _id: any;
      name: string | undefined;
      clientType: "individual" | "company" | undefined;
      hasNewModel: boolean;
    }> = [];

    for (const client of allClients) {
      const hasNewModel = !!(client.naturalezaJuridica && client.displayName);

      if (hasNewModel) {
        alreadyMigrated++;
      } else {
        needsMigration++;
        // Keep first 5 samples
        if (sampleLegacyClients.length < 5) {
          sampleLegacyClients.push({
            _id: client._id,
            name: (client as any).name,
            clientType: (client as any).clientType,
            hasNewModel,
          });
        }
      }
    }

    return {
      total: allClients.length,
      alreadyMigrated,
      needsMigration,
      sampleLegacyClients,
    };
  },
});
