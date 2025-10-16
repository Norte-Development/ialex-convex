import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { requireNewCaseAccess } from "../auth_utils";
import { internal } from "../_generated/api";

// ========================================
// CLERK USER SYNC FUNCTIONS
// ========================================

/**
 * Creates or updates a user record from Clerk authentication data.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.clerkId - The Clerk user ID
 * @param {string} args.email - The user's email address
 * @param {string} args.name - The user's display name
 * @returns {Promise<string>} The user document ID
 * @throws {Error} When not authenticated or ClerkId mismatch
 *
 * @description This function is called during the authentication flow to sync
 * Clerk users with the local database. It ensures security by verifying the
 * authenticated identity matches the provided ClerkId. If the user exists,
 * it updates their data; otherwise, it creates a new user with default settings.
 *
 * @example
 * ```javascript
 * const userId = await getOrCreateUser({
 *   clerkId: "user_123abc",
 *   email: "user@example.com",
 *   name: "John Doe"
 * });
 * ```
 */
// Get or create user from Clerk authentication
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // This function is called during auth flow, so we verify the identity matches
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    // Ensure the clerkId matches the authenticated user
    if (identity.subject !== args.clerkId) {
      throw new Error("Unauthorized: ClerkId mismatch");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update user data if changed
      if (
        existingUser.name !== args.name ||
        existingUser.email !== args.email
      ) {
        await ctx.db.patch(existingUser._id, {
          name: args.name,
          email: args.email,
        });
      }
      return existingUser._id;
    }

    // Create new user with default preferences
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
      preferences: {
        language: "es-AR",
        timezone: "America/Argentina/Buenos_Aires",
        emailNotifications: true,
        caseUpdates: true,
        documentProcessing: true,
        teamInvitations: true,
        agentResponses: true,
        agentResponseStyle: "formal",
        defaultJurisdiction: "argentina",
        autoIncludeContext: true,
        citationFormat: "apa",
        sessionTimeout: 60,
        activityLogVisible: true,
      },
    });


    // Set up Stripe customer for the new user
    await ctx.scheduler.runAfter(0, internal.billing.subscriptions.setupCustomerInternal, {
      userId: userId,
      email: args.email,
      clerkId: args.clerkId,
      name: args.name,
    });

    await ctx.db.insert("usageLimits", {

      entityId: userId,
      entityType: "user",
      casesCount: 0,
      documentsCount: 0,
      aiMessagesThisMonth: 0,
      escritosCount: 0,
      libraryDocumentsCount: 0,
      storageUsedBytes: 0,
      lastResetDate: Date.now(),
      currentMonthStart: Date.now(),
    });

    console.log("Created new user with id:", userId);
    return userId;
  },
});

/**
 * Retrieves user information by Clerk ID.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.clerkId] - The Clerk ID to query (optional, defaults to authenticated user)
 * @returns {Promise<Object|null>} The user document or null if not found
 * @throws {Error} When not authenticated or unauthorized to access other users' data
 *
 * @description This function allows users to retrieve their own data. Users can
 * only access their own user information for privacy and security.
 *
 * @example
 * ```javascript
 * // Get current user's data
 * const user = await getCurrentUser({});
 * ```
 */
// Get current user by Clerk ID
export const getCurrentUser = query({
  args: { clerkId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    // Use the authenticated user's ID or the provided one
    const clerkId = args.clerkId || identity.subject;

    // Only allow users to query their own data
    if (clerkId !== identity.subject) {
      throw new Error("Unauthorized: Cannot access other users' data");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    return user;
  },
});

/**
 * Retrieves user information by email.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.email - The email to query
 * @returns {Promise<Object|null>} The user document or null if not found
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    return user;
  },
});

/**
 * Search users by email or name
 */
export const searchUsers = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const term = args.searchTerm.toLowerCase();

    // Search by email (exact match or contains)
    const emailResults = await ctx.db
      .query("users")
      .withIndex("by_email")
      .collect();

    const filteredResults = emailResults.filter(
      (user) =>
        user._id !== currentUser._id &&
        (user.email.toLowerCase().includes(term) ||
          (user.name && user.name.toLowerCase().includes(term))),
    );

    // Limit results and return only necessary fields
    return filteredResults.slice(0, 10).map((user) => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    }));
  },
});

/**
 * Updates user onboarding and profile information.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.clerkId] - Clerk ID (optional, defaults to current user)
 * @param {string[]} [args.specializations] - Legal specializations
 * @param {string} [args.barNumber] - Bar registration number
 * @param {string} [args.firmName] - Law firm name
 * @param {string} [args.workLocation] - Work location
 * @param {number} [args.experienceYears] - Years of experience
 * @param {string} [args.bio] - Professional biography
 * @param {number} [args.onboardingStep] - Current onboarding step
 * @param {boolean} [args.isOnboardingComplete] - Whether onboarding is complete
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated or unauthorized to update other users
 *
 * @description This function allows users to update their profile and onboarding
 * information. Users can only update their own data for security.
 *
 * @example
 * ```javascript
 * await updateOnboardingInfo({
 *   specializations: ["Derecho Civil", "Derecho Penal"],
 *   barNumber: "12345",
 *   isOnboardingComplete: true
 * });
 * ```
 */
export const updateOnboardingInfo = mutation({
  args: {
    clerkId: v.optional(v.string()),
    fullName: v.optional(v.string()),
    hasDespacho: v.optional(v.boolean()),
    despachoName: v.optional(v.string()),
    role: v.optional(v.string()),
    specializations: v.optional(v.array(v.string())),
    barNumber: v.optional(v.string()),
    firmName: v.optional(v.string()),
    workLocation: v.optional(v.string()),
    experienceYears: v.optional(v.number()),
    bio: v.optional(v.string()),
    onboardingStep: v.optional(v.number()),
    isOnboardingComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    // Use authenticated user's ID or provided one
    const clerkId = args.clerkId || identity.subject;

    // Only allow users to update their own data
    if (clerkId !== identity.subject) {
      throw new Error("Unauthorized: Cannot update other users");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const updateData: any = {};

    // Only update provided fields (map to correct schema fields)
    if (args.fullName !== undefined) updateData.name = args.fullName;
    if (args.hasDespacho !== undefined)
      updateData.hasDespacho = args.hasDespacho;
    if (args.despachoName !== undefined) updateData.firmName = args.despachoName;
    if (args.role !== undefined) updateData.role = args.role;
    if (args.specializations !== undefined)
      updateData.specializations = args.specializations;
    if (args.barNumber !== undefined) updateData.barNumber = args.barNumber;
    if (args.firmName !== undefined) updateData.firmName = args.firmName;
    if (args.workLocation !== undefined)
      updateData.workLocation = args.workLocation;
    if (args.experienceYears !== undefined)
      updateData.experienceYears = args.experienceYears;
    if (args.bio !== undefined) updateData.bio = args.bio;
    if (args.onboardingStep !== undefined)
      updateData.onboardingStep = args.onboardingStep;
    if (args.isOnboardingComplete !== undefined)
      updateData.isOnboardingComplete = args.isOnboardingComplete;

    await ctx.db.patch(user._id, updateData);
    console.log("Updated user onboarding info");
  },
});

/**
 * Finds a user by email.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.email - The email to query
 * @returns {Promise<Object|null>} The user document or null if not found
 */
// Find user by email
// export const findUserByEmail = action({
//   args: { email: v.string() },
//   handler: async (ctx, args) => {
//     const user = await ctx.runQuery(api.functions.users.getUserByEmail, {
//       email: args.email,
//     });
//     return user;
//   },
// });

/**
 * Search for users available to be granted access to a specific case
 * Returns users that match the search term but don't already have access to the case
 */
export const searchAvailableUsersForCase = query({
  args: {
    searchTerm: v.string(),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Require case access to search for users
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get current user to exclude from results

    const trimmedSearch = args.searchTerm.trim();
    if (trimmedSearch.length === 0) {
      return [];
    }

    // Get all users that match the search term (using same logic as searchUsers)
    const term = trimmedSearch.toLowerCase();

    // Get all users and filter by search term
    const allUsers = await ctx.db.query("users").collect();

    const matchingUsers = allUsers.filter(
      (user) =>
        user._id !== currentUser._id &&
        (user.email.toLowerCase().includes(term) ||
          (user.name && user.name.toLowerCase().includes(term))),
    );

    const searchResults = matchingUsers.slice(0, 20);

    console.log(
      `Search term: "${term}", Total users: ${allUsers.length}, Matching users: ${matchingUsers.length}, Search results: ${searchResults.length}`,
    );

    if (searchResults.length === 0) {
      return [];
    }

    // Get case data for direct access check
    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) {
      throw new Error("Case not found");
    }

    // Collect all user IDs that have access to this case
    const usersWithAccess = new Set<string>();

    // 1. Add direct access users (assigned lawyer and creator)
    if (caseData.assignedLawyer) {
      usersWithAccess.add(caseData.assignedLawyer);
    }
    if (caseData.createdBy) {
      usersWithAccess.add(caseData.createdBy);
    }

    // 2. Add users with individual permissions
    const individualAccesses = await ctx.db
      .query("userCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .collect();

    for (const access of individualAccesses) {
      usersWithAccess.add(access.userId);
    }

    // 3. Add users with team access
    const teamAccesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const teamAccess of teamAccesses) {
      // Get all team members
      const teamMembers = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team", (q) => q.eq("teamId", teamAccess.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const member of teamMembers) {
        usersWithAccess.add(member.userId);
      }
    }

    // 4. Add users with specific team member permissions
    const teamMemberAccesses = await ctx.db
      .query("teamMemberCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .collect();

    for (const access of teamMemberAccesses) {
      usersWithAccess.add(access.userId);
    }

    console.log(
      `Users with access to case: ${Array.from(usersWithAccess).length}`,
    );

    // Filter out users that already have access and return in same format as searchUsers
    const availableUsers = searchResults
      .filter((user) => !usersWithAccess.has(user._id))
      .map((user) => ({
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      }));

    console.log(`Available users after filtering: ${availableUsers.length}`);
    return availableUsers;
  },
});

/**
 * Get user by ID
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }

    // Return only necessary fields for privacy
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      firmName: user.firmName,
      specializations: user.specializations,
    };
  },
});

/**
 * Update user preferences
 */
export const updateUserPreferences = mutation({
  args: {
    preferences: v.object({
      // General
      language: v.string(),
      timezone: v.string(),
      
      // Notifications
      emailNotifications: v.boolean(),
      caseUpdates: v.optional(v.boolean()),
      documentProcessing: v.optional(v.boolean()),
      teamInvitations: v.optional(v.boolean()),
      agentResponses: v.optional(v.boolean()),
      eventReminders: v.optional(v.boolean()),
      eventUpdates: v.optional(v.boolean()),
      
      // Agent Preferences
      agentResponseStyle: v.optional(v.string()),
      defaultJurisdiction: v.optional(v.string()),
      autoIncludeContext: v.optional(v.boolean()),
      citationFormat: v.optional(v.string()),
      
      // Privacy & Security
      sessionTimeout: v.optional(v.number()),
      activityLogVisible: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    await ctx.db.patch(currentUser._id, {
      preferences: args.preferences,
    });
    
    return { success: true };
  },
});

/**
 * Search for users by name or email
 */
