import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { getCurrentUserFromAuth, requireAuth } from "../auth_utils";

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

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
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

    // Only update provided fields
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
