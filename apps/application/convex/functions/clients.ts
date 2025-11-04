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
      const caseData = await ctx.db.get(caseId as any) as Doc<"cases"> | null;
      casesMap.set(caseId, caseData);
    }),
  );

  // Assemble the result
  return clients.map((client) => {
    const clientRelations = allRelations.find(
      (r) => r.clientId === client._id,
    );
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
 * Creates a new client record in the system.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.name - The client's full name or company name
 * @param {string} [args.email] - The client's email address
 * @param {string} [args.phone] - The client's phone number
 * @param {string} [args.dni] - Document Nacional de Identidad (for individuals)
 * @param {string} [args.cuit] - Código Único de Identificación Tributaria (for companies)
 * @param {string} [args.address] - The client's physical address
 * @param {"individual" | "company"} args.clientType - Whether this is an individual person or company
 * @param {string} [args.notes] - Additional notes about the client
 * @returns {Promise<string>} The created client's document ID
 * @throws {Error} When not authenticated
 *
 * @description This function creates a new client record with the authenticated user
 * as the creator. Clients can be either individuals (with DNI) or companies (with CUIT).
 * The function automatically sets the client as active and records who created it.
 *
 * @example
 * ```javascript
 * // Create an individual client
 * const clientId = await createClient({
 *   name: "Juan Pérez",
 *   email: "juan@email.com",
 *   dni: "12345678",
 *   clientType: "individual",
 *   phone: "+54 11 1234-5678"
 * });
 *
 * // Create a company client
 * const companyId = await createClient({
 *   name: "Empresa ABC S.A.",
 *   email: "contacto@empresa.com",
 *   cuit: "20-12345678-9",
 *   clientType: "company"
 * });
 * ```
 */
export const createClient = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dni: v.optional(v.string()),
    cuit: v.optional(v.string()),
    address: v.optional(v.string()),
    clientType: v.union(v.literal("individual"), v.literal("company")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const clientId = await ctx.db.insert("clients", {
      name: args.name,
      email: args.email,
      phone: args.phone,
      dni: args.dni,
      cuit: args.cuit,
      address: args.address,
      clientType: args.clientType,
      notes: args.notes,
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
export const getClients = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
    search: v.optional(v.string()),
    clientType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("clients"),
        _creationTime: v.number(),
        name: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        dni: v.optional(v.string()),
        cuit: v.optional(v.string()),
        address: v.optional(v.string()),
        clientType: v.union(v.literal("individual"), v.literal("company")),
        isActive: v.boolean(),
        notes: v.optional(v.string()),
        createdBy: v.id("users"),
        cases: v.array(
          v.object({
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
          }),
        ),
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

    let allClients: Doc<"clients">[] = [];

    if (args.search) {
      // Use search index for better performance
      const searchResults = await ctx.db
        .query("clients")
        .withSearchIndex("search_clients", (q) =>
          q.search("name", args.search!).eq("isActive", true),
        )
        .take(100);

      // Also search by DNI/CUIT manually (since search index only covers name)
      const dniCuitResults = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .filter(
          (q) =>
            q.or(
              q.eq(q.field("dni"), args.search!),
              q.eq(q.field("cuit"), args.search!),
            ),
        )
        .collect();

      // Merge and deduplicate results
      allClients = [...searchResults];
      const existingIds = new Set(searchResults.map((c) => c._id));
      for (const result of dniCuitResults) {
        if (!existingIds.has(result._id)) {
          allClients.push(result);
        }
      }
    } else {
      // Get all active clients
      allClients = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .collect();
    }

    // Filter by accessible clients
    let filteredClients = allClients.filter((c) =>
      accessibleClientIds.has(c._id),
    );

    // Apply client type filter
    if (args.clientType) {
      filteredClients = filteredClients.filter((c) => c.clientType === args.clientType);
    }

    // Apply sorting
    if (args.sortBy && args.sortOrder) {
      filteredClients.sort((a, b) => {
        let aValue, bValue;
        
        switch (args.sortBy) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "clientType":
            aValue = a.clientType;
            bValue = b.clientType;
            break;
          case "createdAt":
          default:
            aValue = a._creationTime;
            bValue = b._creationTime;
            break;
        }

        if (aValue < bValue) return args.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return args.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const numItems = args.paginationOpts?.numItems ?? 10;
    const offset = args.paginationOpts?.cursor ? parseInt(args.paginationOpts.cursor) : 0;
    const startIndex = offset;
    const endIndex = offset + numItems;
    
    const paginatedClients = filteredClients.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredClients.length;
    const continueCursor = isDone ? null : endIndex.toString();

    // Batch fetch related data to avoid N+1 queries
    const clientsWithCases = await batchFetchClientCases(ctx, paginatedClients);

    return {
      page: clientsWithCases,
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
      _id: v.id("clients"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      dni: v.optional(v.string()),
      cuit: v.optional(v.string()),
      address: v.optional(v.string()),
      clientType: v.union(v.literal("individual"), v.literal("company")),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      cases: v.array(
        v.object({
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
        }),
      ),
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

    return clientWithCases;
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
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dni: v.optional(v.string()),
    cuit: v.optional(v.string()),
    address: v.optional(v.string()),
    clientType: v.optional(
      v.union(v.literal("individual"), v.literal("company")),
    ),
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

    // Ensure DNI vs CUIT consistency when switching clientType
    if (patch.clientType) {
      if (patch.clientType === "individual") {
        // keep dni, clear cuit (both explicitly passed empty strings and existing values)
        if (patch.cuit === "" || currentClient.cuit) {
          patch.cuit = undefined as any;
        }
      }
      if (patch.clientType === "company") {
        // keep cuit, clear dni (both explicitly passed empty strings and existing values)
        if (patch.dni === "" || currentClient.dni) {
          patch.dni = undefined as any;
        }
      }
    } else {
      // If clientType is not being changed, only clear fields explicitly passed as empty
      if (patch.cuit === "") patch.cuit = undefined as any;
      if (patch.dni === "") patch.dni = undefined as any;
    }

    await ctx.db.patch(clientId, patch as any);
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
      _id: v.id("clients"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      dni: v.optional(v.string()),
      cuit: v.optional(v.string()),
      address: v.optional(v.string()),
      clientType: v.union(v.literal("individual"), v.literal("company")),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
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
      // Use search index for name search
      const searchResults = await ctx.db
        .query("clients")
        .withSearchIndex("search_clients", (q) =>
          q.search("name", args.searchTerm!).eq("isActive", true),
        )
        .take(limit);

      // Also search by DNI/CUIT
      const dniCuitResults = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .filter(
          (q) =>
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

    // Transform to the format expected by the agent
    return clientsWithBasicCases.map((client) => ({
      ...client,
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
