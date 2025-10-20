import { v } from "convex/values";
import { query, mutation, internalQuery, QueryCtx, MutationCtx } from "../_generated/server";
import {
  getCurrentUserFromAuth,
  requireNewCaseAccess,
  checkNewCaseAccess,
} from "../auth_utils";
import { internal } from "../_generated/api";
import { _checkLimit, _getBillingEntity } from "../billing/features";
import { Id } from "../_generated/dataModel";

// ========================================
// CASE MANAGEMENT
// ========================================

/**
 * Determines team context for a case based on team access
 */
async function getCaseTeamContextHelper(
  ctx: QueryCtx | MutationCtx,
  caseId: Id<"cases">
): Promise<Id<"teams"> | undefined> {
  // Check if any team has access to this case
  const teamAccess = await ctx.db
    .query("caseAccess")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .filter((q) => q.neq(q.field("teamId"), undefined))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
  
  return teamAccess?.teamId;
}

/**
 * Creates a new legal case in the system.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The case title or name
 * @param {string} [args.description] - Detailed description of the case
 * @param {string} [args.expedientNumber] - Judicial case number (número de expediente)
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
 *   expedientNumber: "EXP-2024-12345",
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
    expedientNumber: v.optional(v.string()),
    assignedLawyer: v.optional(v.id("users")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.optional(v.string()),
    estimatedHours: v.optional(v.number()),
    teamId: v.optional(v.id("teams")), // Optional team context
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Check billing limits with team context
    await _checkLimit(ctx, {
      userId: currentUser._id,
      teamId: args.teamId,
      limitType: "cases",
    });

    // Auto-assign to current user if no lawyer specified
    const assignedLawyer = args.assignedLawyer || currentUser._id;

    const caseId = await ctx.db.insert("cases", {
      title: args.title,
      description: args.description,
      expedientNumber: args.expedientNumber,
      assignedLawyer: assignedLawyer,
      createdBy: currentUser._id,
      status: "pendiente",
      priority: args.priority,
      category: args.category,
      estimatedHours: args.estimatedHours,
      startDate: Date.now(),
      isArchived: false,
    });

    await ctx.db.insert("caseAccess", {
      caseId,
      userId: currentUser._id,
      accessLevel: "admin",
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      isActive: true,
    });

    // NEW: If assigned to different lawyer, grant them advanced access
    if (assignedLawyer !== currentUser._id) {
      await ctx.db.insert("caseAccess", {
        caseId,
        userId: assignedLawyer,
        accessLevel: "advanced",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
      });
    }

    // Increment usage counter for correct entity
    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: args.teamId,
    });
    
    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "casesCount",
      amount: 1,
    });

    // If team context, grant team access to case
    if (args.teamId) {
      await ctx.db.insert("caseAccess", {
        caseId,
        teamId: args.teamId,
        accessLevel: "advanced",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
      });
    }

    console.log("Created case with id:", caseId);
    return caseId;
  },
});

/**
 * Updates an existing case.
 */
export const updateCase = mutation({
  args: {
    caseId: v.id("cases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pendiente"),
        v.literal("en progreso"),
        v.literal("completado"),
        v.literal("archivado"),
        v.literal("cancelado"),
      ),
    ),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    category: v.optional(v.string()),
    assignedLawyer: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    const existingCase = await ctx.db.get(args.caseId);
    if (!existingCase) {
      throw new Error("Caso no encontrado");
    }

    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.expedientNumber !== undefined) updates.expedientNumber = args.expedientNumber;
    if (args.status !== undefined) updates.status = args.status;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.category !== undefined) updates.category = args.category;
    if (args.assignedLawyer !== undefined) updates.assignedLawyer = args.assignedLawyer;

    await ctx.db.patch(args.caseId, updates);

    // Send notification if status changed
    if (args.status !== undefined && args.status !== existingCase.status) {
      const { caseUpdateTemplate } = await import("../services/emailTemplates");
      const assignedUser = await ctx.db.get(existingCase.assignedLawyer);
      
      await ctx.scheduler.runAfter(0, internal.services.notificationService.sendNotificationIfEnabled, {
        userId: existingCase.assignedLawyer,
        notificationType: "caseUpdate" as const,
        subject: `Caso actualizado: ${existingCase.title}`,
        htmlBody: caseUpdateTemplate(
          String(existingCase.title),
          String(args.status),
          String(assignedUser?.name || "Usuario")
        ),
      });
    }

    console.log("Updated case:", args.caseId);
    return null;
  },
});

/**
 * Deletes a case and all its related data.
 * Requires admin access level.
 */
export const deleteCase = mutation({
  args: {
    caseId: v.id("cases"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");

    const existingCase = await ctx.db.get(args.caseId);
    if (!existingCase) {
      throw new Error("Caso no encontrado");
    }

    // Delete all related case access records
    const caseAccessRecords = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    
    for (const record of caseAccessRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete all related client-case relationships
    const clientCaseRecords = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    
    for (const record of clientCaseRecords) {
      await ctx.db.delete(record._id);
    }

    // Delete the case itself
    await ctx.db.delete(args.caseId);

    console.log("Deleted case:", args.caseId);
    return null;
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
    status: v.optional(
      v.union(
        v.literal("pendiente"),
        v.literal("en progreso"),
        v.literal("completado"),
        v.literal("archivado"),
        v.literal("cancelado"),
      ),
    ),
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
        .withIndex("by_assigned_lawyer", (q) =>
          q.eq("assignedLawyer", args.assignedLawyer!),
        )
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
      const access = await checkNewCaseAccess(
        ctx,
        currentUser._id,
        caseData._id,
        "basic",
      );
      if (access.hasAccess) {
        accessibleCases.push({
          ...caseData,
          accessLevel: access.userLevel,
          source: access.source,
        });
      }
    }

    return accessibleCases;
  },
});

/**
 * Get a specific case by ID with access validation
 */
export const getCaseById = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) {
      throw new Error("Case not found");
    }

    return caseData;
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
    // Verify user has client write permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // Check if relationship already exists
    const existing = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) =>
        q.eq("clientId", args.clientId).eq("caseId", args.caseId),
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
    // Verify user has client delete permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");

    const relationship = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) =>
        q.eq("clientId", args.clientId).eq("caseId", args.caseId),
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
    // Verify user has client read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const clients = await Promise.all(
      relationships.map(async (rel) => {
        const client = await ctx.db.get(rel.clientId);
        return { ...client, role: rel.role };
      }),
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

    // Filter cases based on user access - only include cases where user has client read permission
    const accessibleCases = [];
    for (const rel of relationships) {
      const access = await checkNewCaseAccess(
        ctx,
        currentUser._id,
        rel.caseId,
        "basic",
      );
      if (access.hasAccess) {
        const caseData = await ctx.db.get(rel.caseId);
        accessibleCases.push({
          ...caseData,
          clientRole: rel.role,
          source: access.source,
          accessLevel: access.userLevel,
        });
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

    // NEW: Use the centralized checkNewCaseAccess helper
    return await checkNewCaseAccess(ctx, userId, args.caseId);
  },
});

/**
 * Internal query to get team context for a case
 * Used by other functions to determine billing entity
 */
export const getCaseTeamContext = internalQuery({
  args: { caseId: v.id("cases") },
  returns: v.union(v.id("teams"), v.null()),
  handler: async (ctx, args) => {
    const teamId = await getCaseTeamContextHelper(ctx, args.caseId);
    return teamId ?? null;
  },
});
