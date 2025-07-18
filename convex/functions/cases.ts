import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess, checkCaseAccess } from "./auth_utils";

// ========================================
// CASE MANAGEMENT
// ========================================

/**
 * Creates a new legal case in the system.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.title - The case title or name
 * @param {string} [args.description] - Detailed description of the case
 * @param {string} [args.assignedLawyer] - User ID of the assigned lawyer (defaults to current user)
 * @param {"low" | "medium" | "high"} args.priority - The priority level of the case
 * @param {string} [args.category] - The legal category or type of case
 * @param {number} [args.estimatedHours] - Estimated hours to complete the case
 * @returns {Promise<string>} The created case's document ID
 * @throws {Error} When not authenticated
 * 
 * @description This function creates a new case with the authenticated user as the creator.
 * If no lawyer is assigned, the case is automatically assigned to the current user.
 * The case starts with "pendiente" status and is not archived by default.
 * 
 * @example
 * ```javascript
 * const caseId = await createCase({
 *   title: "Contract Dispute - ABC Corp",
 *   description: "Commercial contract dispute regarding payment terms",
 *   priority: "high",
 *   category: "Contract Law",
 *   estimatedHours: 40
 * });
 * ```
 */
export const createCase = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignedLawyer: v.optional(v.id("users")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.optional(v.string()),
    estimatedHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Auto-assign to current user if no lawyer specified
    const assignedLawyer = args.assignedLawyer || currentUser._id;
    
    const caseId = await ctx.db.insert("cases", {
      title: args.title,
      description: args.description,
      assignedLawyer: assignedLawyer,
      createdBy: currentUser._id,
      status: "pendiente",
      priority: args.priority,
      category: args.category,
      estimatedHours: args.estimatedHours,
      startDate: Date.now(),
      isArchived: false,
    });
    
    console.log("Created case with id:", caseId);
    return caseId;
  },
});

/**
 * Retrieves cases accessible to the current user with optional filtering.
 * 
 * @param {Object} args - The function arguments
 * @param {"pendiente" | "en progreso" | "completado" | "archivado" | "cancelado"} [args.status] - Filter by case status
 * @param {string} [args.assignedLawyer] - Filter by assigned lawyer user ID
 * @returns {Promise<Object[]>} Array of case documents accessible to the user
 * @throws {Error} When not authenticated
 * 
 * @description This function implements comprehensive access control, returning only cases
 * the user can access through direct assignment (as assigned lawyer or creator) or team
 * membership. The function filters out archived cases and applies additional status or
 * lawyer filters if provided.
 * 
 * Access is granted through:
 * - Direct access: User is the assigned lawyer or case creator
 * - Team access: User belongs to a team with granted access to the case
 * 
 * @example
 * ```javascript
 * // Get all accessible cases
 * const allCases = await getCases({});
 * 
 * // Get only pending cases
 * const pendingCases = await getCases({ status: "pendiente" });
 * 
 * // Get cases assigned to specific lawyer
 * const lawyerCases = await getCases({ assignedLawyer: "user_id_123" });
 * ```
 */
export const getCases = query({
  args: {
    status: v.optional(v.union(
      v.literal("pendiente"),
      v.literal("en progreso"),
      v.literal("completado"),
      v.literal("archivado"),
      v.literal("cancelado")
    )),
    assignedLawyer: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Get all cases, then filter based on access
    let cases;
    if (args.status) {
      cases = await ctx.db
        .query("cases")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else if (args.assignedLawyer) {
      cases = await ctx.db
        .query("cases")
        .withIndex("by_assigned_lawyer", (q) => q.eq("assignedLawyer", args.assignedLawyer!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      cases = await ctx.db
        .query("cases")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }
    
    // Filter cases based on user access (direct or team-based)
    const accessibleCases = [];
    for (const caseData of cases) {
      // Check direct access
      if (caseData.assignedLawyer === currentUser._id || caseData.createdBy === currentUser._id) {
        accessibleCases.push(caseData);
        continue;
      }
      
      // Check team access
      const userMemberships = await ctx.db
        .query("teamMemberships")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      let hasTeamAccess = false;
      for (const membership of userMemberships) {
        const teamAccess = await ctx.db
          .query("teamCaseAccess")
          .withIndex("by_case_and_team", (q) => 
            q.eq("caseId", caseData._id).eq("teamId", membership.teamId)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        
        if (teamAccess) {
          hasTeamAccess = true;
          break;
        }
      }
      
      if (hasTeamAccess) {
        accessibleCases.push(caseData);
      }
    }
    
    return accessibleCases;
  },
});

// ========================================
// CLIENT-CASE RELATIONSHIP MANAGEMENT
// ========================================

/**
 * Associates a client with a case, creating a client-case relationship.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.clientId - The ID of the client to add to the case
 * @param {string} args.caseId - The ID of the case to add the client to
 * @param {string} [args.role] - The client's role in the case (e.g., "plaintiff", "defendant", "witness")
 * @returns {Promise<string>} The created relationship document ID
 * @throws {Error} When not authenticated, lacking case access, or relationship already exists
 * 
 * @description This function creates a many-to-many relationship between clients and cases.
 * The user must have full access to the case to add clients. The function prevents
 * duplicate relationships by checking for existing active associations.
 * 
 * @example
 * ```javascript
 * // Add a client as plaintiff
 * const relationshipId = await addClientToCase({
 *   clientId: "client_123",
 *   caseId: "case_456", 
 *   role: "plaintiff"
 * });
 * ```
 */
export const addClientToCase = mutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.id("cases"),
    role: v.optional(v.string()), // e.g., "plaintiff", "defendant", "witness"
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    // Check if relationship already exists
    const existing = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) => 
        q.eq("clientId", args.clientId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      throw new Error("Client is already associated with this case");
    }
    
    const relationshipId = await ctx.db.insert("clientCases", {
      clientId: args.clientId,
      caseId: args.caseId,
      role: args.role,
      addedBy: currentUser._id,
      isActive: true,
    });
    
    console.log("Added client to case with relationship id:", relationshipId);
    return relationshipId;
  },
});

/**
 * Removes a client from a case by deactivating their relationship.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.clientId - The ID of the client to remove from the case
 * @param {string} args.caseId - The ID of the case to remove the client from
 * @throws {Error} When not authenticated, lacking case access, or relationship doesn't exist
 * 
 * @description This function performs a soft delete by setting the relationship as inactive
 * rather than permanently deleting it. The user must have full access to the case to
 * remove clients.
 * 
 * @example
 * ```javascript
 * await removeClientFromCase({
 *   clientId: "client_123",
 *   caseId: "case_456"
 * });
 * ```
 */
export const removeClientFromCase = mutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    await requireCaseAccess(ctx, args.caseId, "full");
    
    const relationship = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) => 
        q.eq("clientId", args.clientId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!relationship) {
      throw new Error("Client is not associated with this case");
    }
    
    await ctx.db.patch(relationship._id, { isActive: false });
    console.log("Removed client from case");
  },
});

/**
 * Retrieves all clients associated with a specific case.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get clients for
 * @returns {Promise<Object[]>} Array of client documents with their roles in the case
 * @throws {Error} When not authenticated or lacking case access
 * 
 * @description This function returns all active client-case relationships for a given case.
 * Each client object includes their role in the case. The user must have read access
 * to the case to view its clients.
 * 
 * @example
 * ```javascript
 * const clients = await getClientsForCase({ caseId: "case_123" });
 * // Returns: [{ name: "John Doe", email: "...", role: "plaintiff" }, ...]
 * ```
 */
export const getClientsForCase = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const clients = await Promise.all(
      relationships.map(async (rel) => {
        const client = await ctx.db.get(rel.clientId);
        return { ...client, role: rel.role };
      })
    );
    
    return clients;
  },
});

/**
 * Retrieves all cases associated with a specific client.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.clientId - The ID of the client to get cases for
 * @returns {Promise<Object[]>} Array of case documents the user can access, with client roles
 * @throws {Error} When not authenticated
 * 
 * @description This function returns cases associated with a client, but only those
 * the current user has access to view. Each case object includes the client's role
 * in that specific case. Access control is applied per case.
 * 
 * @example
 * ```javascript
 * const cases = await getCasesForClient({ clientId: "client_123" });
 * // Returns: [{ title: "Contract Dispute", clientRole: "plaintiff" }, ...]
 * ```
 */
export const getCasesForClient = query({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Filter cases based on user access
    const accessibleCases = [];
    for (const rel of relationships) {
      const access = await checkCaseAccess(ctx, rel.caseId, currentUser._id);
      if (access.hasAccess) {
        const caseData = await ctx.db.get(rel.caseId);
        accessibleCases.push({ ...caseData, clientRole: rel.role });
      }
    }
    
    return accessibleCases;
  },
});

/**
 * Checks if a user has access to a specific case and returns access details.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.userId] - The user ID to check access for (defaults to current user)
 * @param {string} args.caseId - The ID of the case to check access for
 * @returns {Promise<Object>} Access information object with hasAccess, accessLevel, and source
 * @throws {Error} When not authenticated or unauthorized to check other users' access
 * 
 * @description This function provides a way to programmatically check case access.
 * Users can only check their own access for privacy and security.
 * The returned object contains detailed access information including the source
 * of access (direct or team-based).
 * 
 * @example
 * ```javascript
 * // Check current user's access
 * const access = await checkUserCaseAccess({ caseId: "case_123" });
 * ```
 */
// Helper function to check if a user has access to a case through team membership
export const checkUserCaseAccess = query({
  args: {
    userId: v.optional(v.id("users")),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use provided userId or current user's ID
    const userId = args.userId || currentUser._id;
    
    // Only allow checking your own access
    if (userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot check other users' access");
    }
    
    // Use the centralized checkCaseAccess helper
    return await checkCaseAccess(ctx, args.caseId, userId);
  },
}); 