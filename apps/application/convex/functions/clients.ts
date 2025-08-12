import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// CLIENT MANAGEMENT
// ========================================

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
    search: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        cursor: v.optional(v.string()),
        numItems: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Require authentication to view clients
    await getCurrentUserFromAuth(ctx);

    let clientsResult;

    if (args.search) {
      // When searching, return all matching results without pagination
      const allClients = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .collect();

      // Apply search filter
      const searchLower = args.search.toLowerCase();
      const filteredClients = allClients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          (client.dni && client.dni.includes(args.search!)) ||
          (client.cuit && client.cuit.includes(args.search!)),
      );

      clientsResult = {
        page: filteredClients,
        isDone: true,
        continueCursor: undefined,
      };
    } else {
      // For non-search queries, use Convex's built-in pagination
      const numItems = Math.min(args.paginationOpts?.numItems ?? 10, 100);

      clientsResult = await ctx.db
        .query("clients")
        .withIndex("by_active_status", (q) => q.eq("isActive", true))
        .paginate({
          cursor: args.paginationOpts?.cursor ?? null,
          numItems,
        });
    }

    // For each client in the current page, get their associated cases
    const clientsWithCases = await Promise.all(
      clientsResult.page.map(async (client) => {
        // Get all active client-case relationships for this client
        const clientCaseRelations = await ctx.db
          .query("clientCases")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        // Get the case data for each relationship
        const cases = await Promise.all(
          clientCaseRelations.map(async (relation) => {
            const caseData = await ctx.db.get(relation.caseId);
            return {
              case: caseData,
              role: relation.role,
              relationId: relation._id,
            };
          }),
        );

        // Filter out any cases that might have been deleted
        const validCases = cases.filter(
          ({ case: caseData }) => caseData !== null,
        );

        return {
          ...client,
          cases: validCases,
        };
      }),
    );

    return {
      page: clientsWithCases,
      isDone: clientsResult.isDone,
      continueCursor: clientsResult.continueCursor,
    };
  },
});
