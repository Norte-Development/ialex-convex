import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";
  
// ========================================
// TEAM MANAGEMENT
// ========================================

/**
 * Creates a new team in the system (any authenticated user can create).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.name - The team name
 * @param {string} [args.description] - Optional description of the team
 * @returns {Promise<string>} The created team's document ID
 * @throws {Error} When not authenticated
 * 
 * @description Any authenticated user can create a new team for organizing users
 * into departmental or project-based groups. Teams are used for case access
 * control and organizational structure within the legal practice. The creator
 * is automatically added as an admin member of the team.
 * 
 * @example
 * ```javascript
 * const teamId = await createTeam({
 *   name: "Corporate Law Team",
 *   description: "Handles all corporate legal matters",
 * });
 * ```
 */
export const createTeam = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Any authenticated user can create teams
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      description: args.description,
      teamLead: currentUser._id,
      isActive: true,
      createdBy: currentUser._id,
    });
    
    // Automatically add the creator as an admin member of the team
    await ctx.db.insert("teamMemberships", {
      teamId: teamId,
      userId: currentUser._id,
      role: "admin",
      joinedAt: Date.now(),
      addedBy: currentUser._id,
      isActive: true,
    });
    
    console.log("Created team with id:", teamId);
    return teamId;
  },
});

/**
 * Retrieves all teams with optional filtering.
 * 
 * @param {Object} args - The function arguments
 * @param {boolean} [args.isActive] - Filter by active status (defaults to true)
 * @returns {Promise<Object[]>} Array of team documents
 * @throws {Error} When not authenticated
 * 
 * @description This function returns all teams in the system, with optional
 * filtering by department or active status. Any authenticated user can view
 * teams to understand the organizational structure.
 * 
 * @example
 * ```javascript
 * // Get all active teams
 * const activeTeams = await getTeams({});
 * 
 * // Get all teams including inactive
 * const allTeams = await getTeams({ isActive: false });
 * ```
 */
export const getTeams = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Require authentication to view teams
    await getCurrentUserFromAuth(ctx);
    
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_active_status", (q) => q.eq("isActive", args.isActive ?? true))
      .collect();
    
    return teams;
  },
});

// ========================================
// TEAM MEMBERSHIP MANAGEMENT
// ========================================

/**
 * Adds a user to a team with a specific role (team lead/admin only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to add the user to
 * @param {string} args.userId - The ID of the user to add to the team
 * @param {"secretario" | "abogado" | "admin"} args.role - The role to assign within the team
 * @returns {Promise<string>} The created team membership document ID
 * @throws {Error} When not authenticated, not authorized, or user already in team
 * 
 * @description This function allows team leads and team admins to add users to their teams.
 * The role determines the user's permissions within team operations. The function
 * prevents duplicate memberships by checking for existing active memberships.
 * 
 * Team roles:
 * - "secretario": Administrative/secretarial role
 * - "abogado": Lawyer role
 * - "admin": Team administrative role
 * 
 * @example
 * ```javascript
 * const membershipId = await addUserToTeam({
 *   teamId: "team_123",
 *   userId: "user_456",
 *   role: "abogado"
 * });
 * ```
 */
export const addUserToTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("secretario"), v.literal("abogado"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Check if current user is team lead or team admin
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    
    const isTeamLead = team.teamLead === currentUser._id;
    const userMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const isTeamAdmin = userMembership?.role === "admin";
    
    if (!isTeamLead && !isTeamAdmin) {
      throw new Error("Unauthorized: Only team leads and team admins can add members");
    }
    
    // Check if user is already in the team
    const existing = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      throw new Error("User is already a member of this team");
    }
    
    const membershipId = await ctx.db.insert("teamMemberships", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
      addedBy: currentUser._id,
      isActive: true,
    });
    
    console.log("Added user to team with membership id:", membershipId);
    return membershipId;
  },
});

/**
 * Removes a user from a team (team lead/admin only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to remove the user from
 * @param {string} args.userId - The ID of the user to remove from the team
 * @throws {Error} When not authenticated, not authorized, or user not in team
 * 
 * @description This function allows team leads and team admins to remove users from their teams.
 * This is a soft delete that preserves the membership history while preventing future
 * team-based access.
 * 
 * @example
 * ```javascript
 * await removeUserFromTeam({
 *   teamId: "team_123",
 *   userId: "user_456"
 * });
 * ```
 */
export const removeUserFromTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Check if current user is team lead or team admin
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    
    const isTeamLead = team.teamLead === currentUser._id;
    const userMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const isTeamAdmin = userMembership?.role === "admin";
    
    if (!isTeamLead && !isTeamAdmin) {
      throw new Error("Unauthorized: Only team leads and team admins can remove members");
    }
    
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      throw new Error("User is not a member of this team");
    }
    
    await ctx.db.patch(membership._id, { isActive: false });
    console.log("Removed user from team");
  },
});

/**
 * Retrieves all active members of a specific team.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to get members for
 * @returns {Promise<Object[]>} Array of user documents with team role and join date
 * @throws {Error} When not authenticated
 * 
 * @description This function returns all active members of a team, including
 * their team role and when they joined. Each member object contains the full
 * user information plus team-specific details.
 * 
 * @example
 * ```javascript
 * const members = await getTeamMembers({ teamId: "team_123" });
 * // Returns: [{ name: "John Doe", teamRole: "abogado", joinedAt: 1234567890 }, ...]
 * ```
 */
export const getTeamMembers = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    // Require authentication to view team members
    await getCurrentUserFromAuth(ctx);
    
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return { 
          ...user, 
          teamRole: membership.role,
          joinedAt: membership.joinedAt 
        };
      })
    );
    
    return members;
  },
});

/**
 * Retrieves all teams a user belongs to.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.userId] - User ID to get teams for (defaults to current user)
 * @returns {Promise<Object[]>} Array of team documents with user role and join date
 * @throws {Error} When not authenticated or unauthorized to view other users' teams
 * 
 * @description This function returns all teams a user is an active member of.
 * Users can only view their own teams for privacy and security.
 * Each team object includes the user's role within that team.
 * 
 * @example
 * ```javascript
 * // Get current user's teams
 * const myTeams = await getUserTeams({});
 * 
 * // Returns: [{ name: "Corporate Team", userRole: "abogado", joinedAt: 1234567890 }, ...]
 * ```
 */
export const getUserTeams = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use current user or specified user
    const userId = args.userId || currentUser._id;
    
    // Only allow viewing own teams
    if (userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' teams");
    }
    
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const teams = await Promise.all(
      memberships.map(async (membership) => {
        const team = await ctx.db.get(membership.teamId);
        return { 
          ...team, 
          userRole: membership.role,
          joinedAt: membership.joinedAt 
        };
      })
    );
    
    return teams;
  },
});

// ========================================
// TEAM CASE ACCESS MANAGEMENT
// ========================================

/**
 * Grants a team access to a specific case with defined access level.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to grant access to
 * @param {string} args.teamId - The ID of the team to grant access to
 * @param {"full" | "read"} args.accessLevel - The level of access to grant
 * @returns {Promise<string>} The team case access document ID
 * @throws {Error} When not authenticated or lacking full case access
 * 
 * @description This function grants a team access to a case with specified permissions.
 * The user must have full access to the case to grant team access. If access already
 * exists, the access level is updated. This enables team-based collaboration on cases.
 * 
 * Access levels:
 * - "read": Team members can view case data
 * - "full": Team members can modify case data
 * 
 * @example
 * ```javascript
 * // Grant full access to corporate team
 * const accessId = await grantTeamCaseAccess({
 *   caseId: "case_123",
 *   teamId: "team_456",
 *   accessLevel: "full"
 * });
 * 
 * // Grant read-only access to support team
 * await grantTeamCaseAccess({
 *   caseId: "case_123", 
 *   teamId: "team_789",
 *   accessLevel: "read"
 * });
 * ```
 */
export const grantTeamCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    teamId: v.id("teams"),
    accessLevel: v.union(v.literal("full"), v.literal("read")),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case to grant team access
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    // Check if access already exists
    const existing = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) => 
        q.eq("caseId", args.caseId).eq("teamId", args.teamId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      // Update existing access level
      await ctx.db.patch(existing._id, { 
        accessLevel: args.accessLevel,
        grantedBy: currentUser._id 
      });
      console.log("Updated team case access");
      return existing._id;
    } else {
      // Create new access
      const accessId = await ctx.db.insert("teamCaseAccess", {
        caseId: args.caseId,
        teamId: args.teamId,
        accessLevel: args.accessLevel,
        grantedBy: currentUser._id,
        isActive: true,
      });
      
      console.log("Granted team case access with id:", accessId);
      return accessId;
    }
  },
});

/**
 * Revokes a team's access to a specific case.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to revoke access from
 * @param {string} args.teamId - The ID of the team to revoke access from
 * @throws {Error} When not authenticated, lacking full case access, or team doesn't have access
 * 
 * @description This function revokes a team's access to a case by deactivating
 * the team case access record. The user must have full access to the case to
 * revoke team access. This is a soft delete that preserves access history.
 * 
 * @example
 * ```javascript
 * await revokeTeamCaseAccess({
 *   caseId: "case_123",
 *   teamId: "team_456"
 * });
 * ```
 */
export const revokeTeamCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case to revoke team access
    await requireCaseAccess(ctx, args.caseId, "full");
    
    const access = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) => 
        q.eq("caseId", args.caseId).eq("teamId", args.teamId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!access) {
      throw new Error("Team does not have access to this case");
    }
    
    await ctx.db.patch(access._id, { isActive: false });
    console.log("Revoked team case access");
  },
});

/**
 * Retrieves all teams that have access to a specific case.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get team access for
 * @returns {Promise<Object[]>} Array of team documents with access level and granting user
 * @throws {Error} When not authenticated or lacking case access
 * 
 * @description This function returns all teams that have active access to a case,
 * including their access level and who granted the access. The user must have
 * read access to the case to view its team access permissions.
 * 
 * @example
 * ```javascript
 * const teamsWithAccess = await getTeamsWithCaseAccess({ caseId: "case_123" });
 * // Returns: [{ name: "Corporate Team", accessLevel: "full", grantedBy: "user_789" }, ...]
 * ```
 */
export const getTeamsWithCaseAccess = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case to view team access
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const accesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const teamsWithAccess = await Promise.all(
      accesses.map(async (access) => {
        const team = await ctx.db.get(access.teamId);
        return { 
          ...team, 
          accessLevel: access.accessLevel,
          grantedBy: access.grantedBy 
        };
      })
    );
    
    return teamsWithAccess;
  },
});

/**
 * Retrieves all cases accessible by a specific team.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to get accessible cases for
 * @returns {Promise<Object[]>} Array of case documents with access level for each
 * @throws {Error} When not authenticated
 * 
 * @description This function returns all cases that a team has active access to,
 * including the access level for each case. This helps understand what cases
 * team members can collaborate on.
 * 
 * @example
 * ```javascript
 * const accessibleCases = await getCasesAccessibleByTeam({ teamId: "team_123" });
 * // Returns: [{ title: "Contract Dispute", accessLevel: "full" }, ...]
 * ```
 */
export const getCasesAccessibleByTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    // Require authentication to view team case access
    await getCurrentUserFromAuth(ctx);
    
    const accesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const cases = await Promise.all(
      accesses.map(async (access) => {
        const caseData = await ctx.db.get(access.caseId);
        return { 
          ...caseData, 
          accessLevel: access.accessLevel 
        };
      })
    );
    
    return cases;
  },
}); 

/**
 * Allows a user to voluntarily leave a team.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to leave
 * @throws {Error} When not authenticated or user not in team
 * 
 * @description This function allows users to voluntarily leave teams they are members of.
 * This is a soft delete that preserves the membership history while preventing future
 * team-based access. Users cannot leave a team if they are the team lead.
 * 
 * @example
 * ```javascript
 * await leaveTeam({
 *   teamId: "team_123"
 * });
 * ```
 */
export const leaveTeam = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Check if team exists
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    
    // Don't allow team lead to leave (they should transfer leadership first)
    if (team.teamLead === currentUser._id) {
      throw new Error("Team lead cannot leave team. Please transfer leadership first.");
    }
    
    // Find user's membership in the team
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      throw new Error("You are not a member of this team");
    }
    
    // Remove membership (soft delete)
    await ctx.db.patch(membership._id, { isActive: false });
    console.log("User left team");
  },
}); 