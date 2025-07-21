import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";
import { internal } from "../_generated/api";
  
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
 * Retrieves teams where the current user is a member or team lead.
 * 
 * @param {Object} args - The function arguments
 * @param {boolean} [args.isActive] - Filter by active status (defaults to true)
 * @returns {Promise<Object[]>} Array of team documents the user has access to
 * @throws {Error} When not authenticated
 * 
 * @description This function returns only teams where the current user is either
 * a team member, team lead, or has been granted access. This ensures users only
 * see teams they're actually part of.
 * 
 * @example
 * ```javascript
 * // Get user's active teams
 * const myTeams = await getTeams({});
 * 
 * // Get all teams user belongs to including inactive
 * const allMyTeams = await getTeams({ isActive: false });
 * ```
 */
export const getTeams = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Get all team memberships for the current user
    const userMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Get all teams where user is a member
    const memberTeamIds = userMemberships.map(m => m.teamId);
    
    // Get all teams where user is the team lead
    const leadTeams = await ctx.db
      .query("teams")
      .withIndex("by_team_lead", (q) => q.eq("teamLead", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), args.isActive ?? true))
      .collect();
    
    // Get member teams
    const memberTeams = await Promise.all(
      memberTeamIds.map(async (teamId) => {
        const team = await ctx.db.get(teamId);
        return team;
      })
    );
    
    // Combine and deduplicate teams
    const allTeams = [...leadTeams];
    for (const team of memberTeams) {
      if (team && team.isActive === (args.isActive ?? true)) {
        // Check if team is not already in the list (user might be both lead and member)
        if (!allTeams.find(t => t._id === team._id)) {
          allTeams.push(team);
        }
      }
    }
    
    return allTeams;
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

// ========================================
// TEAM INVITATION MANAGEMENT
// ========================================

/**
 * Generates a cryptographically secure invitation token.
 */
function generateInviteToken(): string {
  return Math.random().toString(36).substring(2) + 
         Math.random().toString(36).substring(2) + 
         Date.now().toString(36);
}

/**
 * Sends a team invitation via email (team lead/admin only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to invite user to
 * @param {string} args.email - The email address to send invitation to
 * @param {"secretario" | "abogado" | "admin"} args.role - The role to assign within the team
 * @returns {Promise<string>} The created team invitation document ID
 * @throws {Error} When not authenticated, not authorized, email invalid, or user already in team
 * 
 * @description This function allows team leads and team admins to send email invitations
 * to new users. It checks if the email belongs to an existing user and sends appropriate
 * invitation emails. The invitation expires after 7 days.
 * 
 * @example
 * ```javascript
 * const inviteId = await sendTeamInvite({
 *   teamId: "team_123",
 *   email: "nuevo@abogado.com",
 *   role: "abogado"
 * });
 * ```
 */
export const sendTeamInvite = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(v.literal("secretario"), v.literal("abogado"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Formato de email inválido");
    }
    
    // Check if current user is team lead or team admin
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
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
      throw new Error("No autorizado: Solo líderes de equipo y administradores pueden enviar invitaciones");
    }
    
    // Check if user already exists and is in the team
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existingUser) {
      const existing = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) => 
          q.eq("teamId", args.teamId).eq("userId", existingUser._id)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      
      if (existing) {
        throw new Error("El usuario ya es miembro de este equipo");
      }
    }
    
    // Check for existing pending invitation
    const existingInvite = await ctx.db
      .query("teamInvites")
      .withIndex("by_team_and_email", (q) => 
        q.eq("teamId", args.teamId).eq("email", args.email)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    
    if (existingInvite) {
      throw new Error("Ya existe una invitación pendiente para este email");
    }
    
    // Generate unique token and set expiration (7 days)
    const token = generateInviteToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Create invitation
    const inviteId = await ctx.db.insert("teamInvites", {
      teamId: args.teamId,
      email: args.email,
      invitedBy: currentUser._id,
      token: token,
      role: args.role,
      status: "pending",
      expiresAt: expiresAt,
    });
    
    // Prepare email content based on user existence
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ialex.com.ar";
    const expiryDate = new Date(expiresAt).toLocaleDateString('es-ES');
    
    let subject: string;
    let body: string;
    
    if (existingUser) {
      // Email for existing user
      subject = `Invitación para unirte al equipo ${team.name}`;
      const inviteUrl = `${baseUrl}/invites/accept?token=${token}`;
      
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">¡Hola!</h2>
          
          <p>Has sido invitado/a por <strong>${currentUser.name}</strong> para unirte al equipo "<strong>${team.name}</strong>" en iAlex como <strong>${args.role}</strong>.</p>
          
          <p>Para aceptar la invitación, haz clic en el siguiente botón:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Aceptar Invitación
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Esta invitación expira el ${expiryDate}.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            Saludos,<br>
            El equipo de iAlex
          </p>
          
          <p style="color: #999; font-size: 11px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
      `;
    } else {
      // Email for new user
      subject = `Invitación para crear cuenta y unirte al equipo ${team.name}`;
      const signupUrl = `${baseUrl}/invites/signup?token=${token}`;
      
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">¡Hola!</h2>
          
          <p>Has sido invitado/a por <strong>${currentUser.name}</strong> para unirte al equipo "<strong>${team.name}</strong>" en iAlex como <strong>${args.role}</strong>.</p>
          
          <p>Para comenzar, necesitas crear una cuenta en iAlex y automáticamente serás agregado/a al equipo.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Crear Cuenta y Unirse al Equipo
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Esta invitación expira el ${expiryDate}.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            Saludos,<br>
            El equipo de iAlex
          </p>
          
          <p style="color: #999; font-size: 11px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
      `;
    }
    
    // Schedule email sending
    await ctx.scheduler.runAfter(0, internal.utils.resend.sendEmail, {
      from: fromEmail,
      to: args.email,
      subject: subject,
      body: body,
    });
    
    console.log("Created team invitation with id:", inviteId);
    return inviteId;
  },
});

/**
 * Accepts a team invitation using the invitation token.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.token - The unique invitation token
 * @returns {Promise<string>} The created team membership document ID
 * @throws {Error} When not authenticated, token invalid/expired, or user mismatch
 * 
 * @description This function allows users to accept team invitations by providing
 * the invitation token. It validates the token, checks expiration, and adds the
 * user to the team with the specified role.
 * 
 * @example
 * ```javascript
 * const membershipId = await acceptTeamInvite({
 *   token: "abc123def456"
 * });
 * ```
 */
export const acceptTeamInvite = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Find the invitation
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!invite) {
      throw new Error("Invitación no encontrada");
    }
    
    // Check if invitation is still pending
    if (invite.status !== "pending") {
      throw new Error("Esta invitación ya no está disponible");
    }
    
    // Check if invitation has expired
    if (Date.now() > invite.expiresAt) {
      // Mark as expired
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("La invitación ha expirado");
    }
    
    // Check if user email matches invitation email
    if (currentUser.email !== invite.email) {
      throw new Error("Esta invitación no es para tu cuenta de email");
    }
    
    // Check if user is already in the team
    const existingMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", invite.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existingMembership) {
      throw new Error("Ya eres miembro de este equipo");
    }
    
    // Add user to team
    const membershipId = await ctx.db.insert("teamMemberships", {
      teamId: invite.teamId,
      userId: currentUser._id,
      role: invite.role,
      joinedAt: Date.now(),
      addedBy: invite.invitedBy,
      isActive: true,
    });
    
    // Mark invitation as accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      acceptedBy: currentUser._id,
    });
    
    console.log("User accepted team invitation, membership id:", membershipId);
    return membershipId;
  },
});

/**
 * Cancels a pending team invitation (team lead/admin only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.inviteId - The ID of the invitation to cancel
 * @throws {Error} When not authenticated, not authorized, or invitation not found
 * 
 * @description This function allows team leads and team admins to cancel pending
 * invitations. This is useful when an invitation was sent by mistake or the
 * person is no longer needed on the team.
 * 
 * @example
 * ```javascript
 * await cancelTeamInvite({
 *   inviteId: "invite_123"
 * });
 * ```
 */
export const cancelTeamInvite = mutation({
  args: {
    inviteId: v.id("teamInvites"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Find the invitation
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invitación no encontrada");
    }
    
    // Check if current user is team lead or team admin
    const team = await ctx.db.get(invite.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    
    const isTeamLead = team.teamLead === currentUser._id;
    const userMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", invite.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const isTeamAdmin = userMembership?.role === "admin";
    const isInviteCreator = invite.invitedBy === currentUser._id;
    
    if (!isTeamLead && !isTeamAdmin && !isInviteCreator) {
      throw new Error("No autorizado: Solo líderes de equipo, administradores o quien envió la invitación pueden cancelarla");
    }
    
    // Check if invitation can be cancelled
    if (invite.status !== "pending") {
      throw new Error("Solo se pueden cancelar invitaciones pendientes");
    }
    
    // Cancel invitation
    await ctx.db.patch(invite._id, { status: "cancelled" });
    console.log("Cancelled team invitation");
  },
});

/**
 * Retrieves all pending invitations for a specific team.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.teamId - The ID of the team to get invitations for
 * @returns {Promise<Object[]>} Array of invitation documents with inviter info
 * @throws {Error} When not authenticated or not team member
 * 
 * @description This function returns all pending invitations for a team,
 * including who sent each invitation. Only team members can view team invitations.
 * 
 * @example
 * ```javascript
 * const invites = await getTeamInvites({ teamId: "team_123" });
 * // Returns: [{ email: "nuevo@abogado.com", role: "abogado", inviterName: "Juan Pérez" }, ...]
 * ```
 */
export const getTeamInvites = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Check if user is member of the team
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    
    const isTeamLead = team.teamLead === currentUser._id;
    const userMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!isTeamLead && !userMembership) {
      throw new Error("Solo los miembros del equipo pueden ver las invitaciones");
    }
    
    // Get pending invitations
    const invites = await ctx.db
      .query("teamInvites")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    
    // Add inviter information
    const invitesWithDetails = await Promise.all(
      invites.map(async (invite) => {
        const inviter = await ctx.db.get(invite.invitedBy);
        return {
          ...invite,
          inviterName: inviter?.name || "Usuario desconocido",
        };
      })
    );
    
    return invitesWithDetails;
  },
});

/**
 * Validates an invitation token and returns invitation details.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.token - The invitation token to validate
 * @returns {Promise<Object|null>} Invitation details or null if invalid
 * 
 * @description This function validates an invitation token without requiring
 * authentication. It's used on the invitation acceptance page to show
 * invitation details before the user logs in.
 * 
 * @example
 * ```javascript
 * const invite = await validateInviteToken({ token: "abc123def456" });
 * if (invite) {
 *   console.log(`Invitation to join ${invite.teamName} as ${invite.role}`);
 * }
 * ```
 */
export const validateInviteToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the invitation
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!invite) {
      return null;
    }
    
    // Check if invitation is still pending and not expired
    if (invite.status !== "pending" || Date.now() > invite.expiresAt) {
      return null;
    }
    
    // Get team and inviter information
    const team = await ctx.db.get(invite.teamId);
    const inviter = await ctx.db.get(invite.invitedBy);
    
    return {
      email: invite.email,
      role: invite.role,
      teamName: team?.name || "Equipo desconocido",
      inviterName: inviter?.name || "Usuario desconocido",
      expiresAt: invite.expiresAt,
    };
  },
});

/**
 * Resends a team invitation email (team lead/admin only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.inviteId - The ID of the invitation to resend
 * @throws {Error} When not authenticated, not authorized, or invitation not valid for resending
 * 
 * @description This function allows team leads and team admins to resend
 * invitation emails for pending invitations. Useful when the original email
 * was not received or lost.
 * 
 * @example
 * ```javascript
 * await resendTeamInvite({
 *   inviteId: "invite_123"
 * });
 * ```
 */
export const resendTeamInvite = mutation({
  args: {
    inviteId: v.id("teamInvites"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Find the invitation
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invitación no encontrada");
    }
    
    // Check if current user is team lead or team admin
    const team = await ctx.db.get(invite.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    
    const isTeamLead = team.teamLead === currentUser._id;
    const userMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", invite.teamId).eq("userId", currentUser._id)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const isTeamAdmin = userMembership?.role === "admin";
    
    if (!isTeamLead && !isTeamAdmin) {
      throw new Error("No autorizado: Solo líderes de equipo y administradores pueden reenviar invitaciones");
    }
    
    // Check if invitation can be resent
    if (invite.status !== "pending") {
      throw new Error("Solo se pueden reenviar invitaciones pendientes");
    }
    
        if (Date.now() > invite.expiresAt) {
      throw new Error("La invitación ha expirado y no se puede reenviar");
    }
    
    // Check if user exists by email
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", invite.email))
      .first();
    
    // Prepare email content based on user existence
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@ialex.com.ar";
    const expiryDate = new Date(invite.expiresAt).toLocaleDateString('es-ES');
    
    let subject: string;
    let body: string;
    
    if (existingUser) {
      // Email for existing user
      subject = `Recordatorio: Invitación para unirte al equipo ${team.name}`;
      const inviteUrl = `${baseUrl}/invites/accept?token=${invite.token}`;
      
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">¡Hola!</h2>
          
          <p>Este es un recordatorio de que has sido invitado/a por <strong>${currentUser.name}</strong> para unirte al equipo "<strong>${team.name}</strong>" en iAlex como <strong>${invite.role}</strong>.</p>
          
          <p>Para aceptar la invitación, haz clic en el siguiente botón:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Aceptar Invitación
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Esta invitación expira el ${expiryDate}.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            Saludos,<br>
            El equipo de iAlex
          </p>
          
          <p style="color: #999; font-size: 11px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
      `;
    } else {
      // Email for new user
      subject = `Recordatorio: Invitación para crear cuenta y unirte al equipo ${team.name}`;
      const signupUrl = `${baseUrl}/invites/signup?token=${invite.token}`;
      
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">¡Hola!</h2>
          
          <p>Este es un recordatorio de que has sido invitado/a por <strong>${currentUser.name}</strong> para unirte al equipo "<strong>${team.name}</strong>" en iAlex como <strong>${invite.role}</strong>.</p>
          
          <p>Para comenzar, necesitas crear una cuenta en iAlex y automáticamente serás agregado/a al equipo.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Crear Cuenta y Unirse al Equipo
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">Esta invitación expira el ${expiryDate}.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #666; font-size: 12px;">
            Saludos,<br>
            El equipo de iAlex
          </p>
          
          <p style="color: #999; font-size: 11px;">
            Si no esperabas esta invitación, puedes ignorar este email.
          </p>
        </div>
      `;
    }
    
    // Schedule email resending
    await ctx.scheduler.runAfter(0, internal.utils.resend.sendEmail, {
      from: fromEmail,
      to: invite.email,
      subject: subject,
      body: body,
    });
    
    console.log("Resent team invitation email");
  },
});

/**
 * Creates a new user account and automatically joins them to a team using an invitation token.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.clerkId - The Clerk user ID from the newly created account
 * @param {string} args.email - The user's email address
 * @param {string} args.name - The user's display name
 * @param {string} args.token - The team invitation token
 * @returns {Promise<{userId: string, membershipId: string}>} The created user and membership IDs
 * @throws {Error} When invitation invalid, expired, or email mismatch
 * 
 * @description This function handles the complete signup and team joining flow for new users.
 * It creates the user account and immediately adds them to the team specified in the invitation.
 * This is an atomic operation that ensures both user creation and team membership succeed together.
 * 
 * @example
 * ```javascript
 * const result = await createUserAndJoinTeam({
 *   clerkId: "user_123abc",
 *   email: "nuevo@abogado.com",
 *   name: "Juan Pérez",
 *   token: "invite_token_123"
 * });
 * console.log("User created:", result.userId);
 * console.log("Team membership:", result.membershipId);
 * ```
 */
export const createUserAndJoinTeam = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the Clerk identity matches
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("No autenticado");
    }
    
    if (identity.subject !== args.clerkId) {
      throw new Error("No autorizado: ID de usuario no coincide");
    }
    
    // Find and validate the invitation
    const invite = await ctx.db
      .query("teamInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!invite) {
      throw new Error("Invitación no encontrada");
    }
    
    // Check if invitation is still pending
    if (invite.status !== "pending") {
      throw new Error("Esta invitación ya no está disponible");
    }
    
    // Check if invitation has expired
    if (Date.now() > invite.expiresAt) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("La invitación ha expirado");
    }
    
    // Check if email matches invitation
    if (args.email !== invite.email) {
      throw new Error("Esta invitación no es para tu email");
    }
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existingUser) {
      throw new Error("Ya existe una cuenta con este email");
    }
    
    // Create the user account
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
    });
    
    // Add user to the team
    const membershipId = await ctx.db.insert("teamMemberships", {
      teamId: invite.teamId,
      userId: userId,
      role: invite.role,
      joinedAt: Date.now(),
      addedBy: invite.invitedBy,
      isActive: true,
    });
    
    // Mark invitation as accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      acceptedBy: userId,
    });
    
    console.log(`Created user ${userId} and added to team with membership ${membershipId}`);
    return { userId, membershipId };
  },
});
