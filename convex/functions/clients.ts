import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "./auth_utils";

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
 * Retrieves all active clients with optional search filtering.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.search] - Search term to filter clients by name, DNI, or CUIT
 * @returns {Promise<Object[]>} Array of active client documents
 * @throws {Error} When not authenticated
 *
 * @description This function returns all active clients in the system. The search parameter
 * allows filtering by client name (case-insensitive), DNI, or CUIT. Only active clients
 * are returned to avoid showing deleted/deactivated records.
 *
 * @example
 * ```javascript
 * // Get all active clients
 * const allClients = await getClients({});
 *
 * // Search for clients by name
 * const searchResults = await getClients({ search: "juan" });
 *
 * // Search by DNI
 * const clientByDni = await getClients({ search: "12345678" });
 * ```
 */
export const getClients = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authentication to view clients
    await getCurrentUserFromAuth(ctx);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_active_status", (q) => q.eq("isActive", true))
      .collect();

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      return clients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          (client.dni && client.dni.includes(args.search!)) ||
          (client.cuit && client.cuit.includes(args.search!)),
      );
    }

    return clients;
  },
});
