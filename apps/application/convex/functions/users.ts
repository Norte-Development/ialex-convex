import { v } from "convex/values";
import { query, mutation, action, internalQuery, internalMutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { requireNewCaseAccess } from "../auth_utils";
import { internal, api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

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
    startTrial: v.optional(v.boolean()),
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

    console.log("🔍 getOrCreateUser called with args:", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      startTrial: args.startTrial,
    });

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      console.log("👤 User already exists:", {
        _id: existingUser._id,
        trialStatus: existingUser.trialStatus,
        hasUsedTrial: existingUser.hasUsedTrial,
        trialEndDate: existingUser.trialEndDate,
      });

      // If startTrial is true and user doesn't have trial info, update with trial
      if (
        args.startTrial &&
        (!existingUser.trialStatus || existingUser.trialStatus === "none")
      ) {
        console.log("🔄 Updating existing user with trial info");
        const now = Date.now();
        const trialEndDate = now + 14 * 24 * 60 * 60 * 1000;

        await ctx.db.patch(existingUser._id, {
          name: args.name,
          email: args.email,
          hasUsedTrial: true,
          trialStatus: "active",
          trialStartDate: now,
          trialEndDate: trialEndDate,
          trialPlan: "premium_individual",
        });
      } else {
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
      }
      return existingUser._id;
    }

    // For new users: Check if starting a trial
    if (args.startTrial) {
      // Check if email has used trial before
      const previousUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .filter((q) => q.eq(q.field("hasUsedTrial"), true))
        .first();

      if (previousUser) {
        throw new Error("Este email ya ha usado una prueba gratuita");
      }
    }

    const now = Date.now();
    const trialEndDate = args.startTrial
      ? now + 14 * 24 * 60 * 60 * 1000
      : undefined;

    console.log("🆕 Creating new user with trial info:", {
      startTrial: args.startTrial,
      trialStatus: args.startTrial ? "active" : "none",
      trialEndDate: trialEndDate,
      hasUsedTrial: args.startTrial || false,
    });

    // Create new user with default preferences
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
      hasUsedTrial: args.startTrial || false,
      trialStatus: args.startTrial ? "active" : "none",
      trialStartDate: args.startTrial ? now : undefined,
      trialEndDate: trialEndDate,
      trialPlan: args.startTrial ? "premium_individual" : undefined,
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
        doctrineSearchSites: ["https://www.saij.gob.ar/", "https://www.pensamientopenal.com.ar/doctrina/"],
        sessionTimeout: 60,
        activityLogVisible: true,
      },
    });

    // Set up Stripe customer for the new user
    await ctx.scheduler.runAfter(
      0,
      internal.billing.subscriptions.setupCustomerInternal,
      {
        userId: userId,
        email: args.email,
        clerkId: args.clerkId,
        name: args.name,
      },
    );

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

    // Schedule trial emails if trial started
    if (args.startTrial && trialEndDate) {
      // Send welcome email immediately (this will schedule all other emails in the chain)
      await ctx.scheduler.runAfter(
        0,
        internal.billing.trials.sendTrialWelcome,
        {
          userId: userId,
          email: args.email,
          name: args.name,
        },
      );
    }

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

export const getDoctrineSearchSites = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) : Promise<string[]> => {
    const user = await ctx.db.get(args.userId);
    return user?.preferences?.doctrineSearchSites || [];
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
    if (args.despachoName !== undefined)
      updateData.firmName = args.despachoName;
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
      preferences: user.preferences,
    };
  },
});

/**
 * Internal query to get user by ID (for internal use)
 */
export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return null;
    }

    // Return only necessary fields
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      preferences: user.preferences,
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
      pjnNotifications: v.optional(v.boolean()),

      // Agent Preferences
      agentResponseStyle: v.optional(v.string()),
      defaultJurisdiction: v.optional(v.string()),
      autoIncludeContext: v.optional(v.boolean()),
      citationFormat: v.optional(v.string()),
      doctrineSearchSites: v.optional(v.array(v.string())),

      // Privacy & Security
      sessionTimeout: v.optional(v.number()),
      activityLogVisible: v.optional(v.boolean()),

      // WhatsApp
      whatsappNumber: v.optional(v.string()),
      whatsappVerified: v.optional(v.boolean()),
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
 * Update user profile fields (specializations, workLocation, etc.)
 */
export const updateUserProfile = mutation({
  args: {
    specializations: v.optional(v.array(v.string())),
    workLocation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const updates: any = {};

    if (args.specializations !== undefined) {
      updates.specializations = args.specializations;
    }

    if (args.workLocation !== undefined) {
      updates.workLocation = args.workLocation;
    }

    await ctx.db.patch(currentUser._id, updates);

    return { success: true };
  },
});

/**
 * Search for users by name or email
 */

// ========================================
// WHATSAPP CONNECTION FUNCTIONS
// ========================================

/**
 * Request WhatsApp verification code
 * Sends a verification code via Twilio Verify service
 */
export const requestWhatsappVerification = action({
  args: {
    phoneNumber: v.string(), // Phone number in E.164 format (e.g., +1234567890)
  },
  handler: async (ctx, args) => {
    // Get current user - need to use mutation context for auth
    const userId = await ctx.runMutation(api.functions.users.getCurrentUserIdForAction, {});
    
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Validate phone number format (basic E.164 format check)
    if (!args.phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Formato de número inválido. Debe estar en formato E.164 (ej: +1234567890)');
    }

    // Send verification code via Twilio Verify
    await ctx.runAction(internal.whatsapp.twilio.sendVerificationCode, {
      to: args.phoneNumber,
    });

    return { success: true };
  },
});

/**
 * Internal mutation to get user ID for action context
 */
export const getCurrentUserIdForAction = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserFromAuth(ctx);
    return user._id;
  },
});

/**
 * Verify WhatsApp code and connect account
 * Verifies the code entered by user and connects their WhatsApp number
 */
export const verifyWhatsappCode = action({
  args: {
    phoneNumber: v.string(), // Phone number in E.164 format
    code: v.string(), // Verification code entered by user
  },
  handler: async (ctx, args) => {
    // Get current user ID
    const userId = await ctx.runMutation(api.functions.users.getCurrentUserIdForAction, {});
    
    if (!userId) {
      throw new Error('Not authenticated');
    }

    // Get current user to access preferences
    const currentUser = await ctx.runQuery(api.functions.users.getCurrentUser, {});

    // Validate phone number format
    if (!args.phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Formato de número inválido');
    }

    // Check verification code via Twilio Verify
    const result = await ctx.runAction(internal.whatsapp.twilio.checkVerificationCode, {
      to: args.phoneNumber,
      code: args.code,
    });

    if (!result.valid) {
      throw new Error('Código de verificación inválido o expirado');
    }

    // Update user preferences with verified WhatsApp number
    const currentPreferences = currentUser?.preferences || {
      language: 'es-AR',
      timezone: 'America/Argentina/Buenos_Aires',
      emailNotifications: true,
    };

    await ctx.runMutation(internal.functions.users.updateWhatsappPreferences, {
      userId,
      preferences: {
        ...currentPreferences,
        whatsappNumber: args.phoneNumber,
        whatsappVerified: true,
      },
    });

    return { success: true };
  },
});

/**
 * Internal mutation to update WhatsApp preferences
 */
export const updateWhatsappPreferences = internalMutation({
  args: {
    userId: v.id("users"),
    preferences: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      preferences: args.preferences,
    });
  },
});

/**
 * Disconnect WhatsApp account
 * Removes the connected WhatsApp number from user preferences
 */
export const disconnectWhatsapp = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const currentPreferences = currentUser.preferences || {
      language: 'es-AR',
      timezone: 'America/Argentina/Buenos_Aires',
      emailNotifications: true,
    };

    await ctx.db.patch(currentUser._id, {
      preferences: {
        ...currentPreferences,
        whatsappNumber: undefined,
        whatsappVerified: undefined,
      },
    });

    return { success: true };
  },
});

/**
 * Get user by WhatsApp number (internal query)
 * Used for routing incoming WhatsApp messages to the correct user
 */
export const getUserByWhatsappNumber = query({
  args: {
    phoneNumber: v.string(), // Phone number in E.164 format
  },
  handler: async (ctx, args) => {
    // Query all users and filter by WhatsApp number
    // Note: Convex doesn't support indexing nested fields, so we scan
    // This should be fine for reasonable user counts
    const users = await ctx.db.query('users').collect();
    
    const user = users.find(
      (u) => u.preferences?.whatsappNumber === args.phoneNumber && u.preferences?.whatsappVerified === true
    );

    return user ? { _id: user._id } : null;
  },
});

/**
 * Internal query version for use in actions
 */
export const getUserByWhatsappNumberInternal = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query('users').collect();
    
    const user = users.find(
      (u) => u.preferences?.whatsappNumber === args.phoneNumber && u.preferences?.whatsappVerified === true
    );

    return user ? { _id: user._id } : null;
  },
});

/**
 * Get Twilio WhatsApp number for QR code generation
 * Returns the WhatsApp number that users can message to start chatting
 */
export const getWhatsappNumber = action({
  args: {},
  handler: async (ctx) => {
    // Get the WhatsApp number from environment variable
    // This is the number users will message to start chatting
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!whatsappNumber) {
      throw new Error('WhatsApp number not configured');
    }

    // Remove whatsapp: prefix if present and return clean number
    return {
      number: whatsappNumber.replace('whatsapp:', '').replace(/^\+/, '')
    };
  },
});

// ========================================
// ADMIN FUNCTIONS - USE WITH CAUTION
// ========================================

/**
 * ADMIN: Manually activate trial for a user by email
 *
 * Usage from CLI (production):
 *
 * DRY RUN (no modifica nada, solo muestra qué haría):
 * npx convex run functions/users:adminActivateTrial --prod '{"email": "cliente@email.com", "dryRun": true}'
 *
 * EJECUTAR DE VERDAD:
 * npx convex run functions/users:adminActivateTrial --prod '{"email": "cliente@email.com"}'
 *
 * Con días específicos:
 * npx convex run functions/users:adminActivateTrial --prod '{"email": "cliente@email.com", "trialDays": 14}'
 */
export const adminActivateTrial = internalMutation({
  args: {
    email: v.string(),
    trialDays: v.optional(v.number()), // Default 14 days
    dryRun: v.optional(v.boolean()), // Si es true, no modifica nada
  },
  handler: async (ctx, args) => {
    const trialDays = args.trialDays ?? 14;
    const dryRun = args.dryRun ?? false;

    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(`Usuario no encontrado con email: ${args.email}`);
    }

    const now = Date.now();
    const trialEndDate = now + trialDays * 24 * 60 * 60 * 1000;

    if (dryRun) {
      console.log(`🔍 DRY RUN - No se modificará nada`);
      console.log(`   Usuario encontrado:`);
      console.log(`   - ID: ${user._id}`);
      console.log(`   - Nombre: ${user.name}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Trial Status actual: ${user.trialStatus ?? "none"}`);
      console.log(`   - Has Used Trial: ${user.hasUsedTrial ?? false}`);
      console.log(`   ---`);
      console.log(`   Se aplicaría:`);
      console.log(`   - Trial Status: active`);
      console.log(`   - Trial Start: ${new Date(now).toISOString()}`);
      console.log(`   - Trial End: ${new Date(trialEndDate).toISOString()}`);
      console.log(`   - Days: ${trialDays}`);

      return {
        dryRun: true,
        wouldModify: true,
        userId: user._id,
        userName: user.name,
        email: args.email,
        currentTrialStatus: user.trialStatus ?? "none",
        newTrialStatus: "active",
        trialStartDate: now,
        trialEndDate: trialEndDate,
        trialDays: trialDays,
      };
    }

    // Activate trial (only if not dry run)
    await ctx.db.patch(user._id, {
      trialStatus: "active",
      trialStartDate: now,
      trialEndDate: trialEndDate,
      trialPlan: "premium_individual",
      hasUsedTrial: true,
    });

    console.log(`✅ Trial activado para ${args.email}`);
    console.log(`   - User ID: ${user._id}`);
    console.log(`   - Trial Start: ${new Date(now).toISOString()}`);
    console.log(`   - Trial End: ${new Date(trialEndDate).toISOString()}`);
    console.log(`   - Days: ${trialDays}`);

    return {
      dryRun: false,
      success: true,
      userId: user._id,
      email: args.email,
      trialStartDate: now,
      trialEndDate: trialEndDate,
      trialDays: trialDays,
    };
  },
});
