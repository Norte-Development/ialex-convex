import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireAuth, requireAdmin } from "./auth_utils";

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
      if (existingUser.name !== args.name || existingUser.email !== args.email) {
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
      role: "lawyer", // Default role, can be changed later
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
    });
    
    console.log("Created new user with id:", userId);
    return userId;
  },
});

/**
 * Retrieves user information by Clerk ID with admin override capability.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.clerkId] - The Clerk ID to query (optional, defaults to authenticated user)
 * @returns {Promise<Object|null>} The user document or null if not found
 * @throws {Error} When not authenticated or unauthorized to access other users' data
 * 
 * @description This function allows users to retrieve their own data, while admins
 * can query any user's data by providing a different ClerkId. The function enforces
 * proper authorization to prevent unauthorized data access.
 * 
 * @example
 * ```javascript
 * // Get current user's data
 * const user = await getCurrentUser({});
 * 
 * // Admin querying another user
 * const otherUser = await getCurrentUser({ clerkId: "user_456def" });
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
    
    // Use the authenticated user's ID or the provided one (for admin queries)
    const clerkId = args.clerkId || identity.subject;
    
    // Only allow users to query their own data unless admin
    if (clerkId !== identity.subject) {
      const currentUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Unauthorized: Cannot access other users' data");
      }
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    
    return user;
  },
});

/**
 * Updates user onboarding and profile information.
 * 
 * @param {Object} args - The function arguments with optional profile fields
 * @param {string} [args.clerkId] - Target user's Clerk ID (defaults to authenticated user)
 * @param {"admin" | "lawyer" | "assistant"} [args.role] - User's role in the system
 * @param {string[]} [args.specializations] - Legal specialization areas
 * @param {string} [args.barNumber] - Bar association number
 * @param {string} [args.firmName] - Law firm name
 * @param {string} [args.workLocation] - Work location/office
 * @param {number} [args.experienceYears] - Years of legal experience
 * @param {string} [args.bio] - Professional biography
 * @param {number} [args.onboardingStep] - Current onboarding step (1-N)
 * @param {boolean} [args.isOnboardingComplete] - Whether onboarding is finished
 * @returns {Promise<string>} The updated user's document ID
 * @throws {Error} When not authenticated, user not found, or unauthorized to update other users
 * 
 * @description This function handles both onboarding flow updates and general profile
 * updates. Users can only update their own profiles unless they have admin privileges.
 * Only provided fields are updated, allowing for partial updates.
 * 
 * @example
 * ```javascript
 * // Complete onboarding step
 * await updateOnboardingInfo({
 *   onboardingStep: 2,
 *   role: "lawyer",
 *   specializations: ["Corporate Law", "Contract Law"]
 * });
 * 
 * // Finish onboarding
 * await updateOnboardingInfo({
 *   isOnboardingComplete: true,
 *   bio: "Experienced corporate lawyer..."
 * });
 * ```
 */
// Update user onboarding information
export const updateOnboardingInfo = mutation({
  args: {
    clerkId: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("lawyer"), v.literal("assistant"))),
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
    
    // Use authenticated user's ID or provided one (ensure it matches for non-admins)
    const clerkId = args.clerkId || identity.subject;
    
    // Only allow users to update their own data (unless admin)
    if (clerkId !== identity.subject) {
      // Check if current user is admin
      const currentUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();
      
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Unauthorized: Cannot update other users");
      }
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
    if (args.role !== undefined) updateData.role = args.role;
    if (args.specializations !== undefined) updateData.specializations = args.specializations;
    if (args.barNumber !== undefined) updateData.barNumber = args.barNumber;
    if (args.firmName !== undefined) updateData.firmName = args.firmName;
    if (args.workLocation !== undefined) updateData.workLocation = args.workLocation;
    if (args.experienceYears !== undefined) updateData.experienceYears = args.experienceYears;
    if (args.bio !== undefined) updateData.bio = args.bio;
    if (args.onboardingStep !== undefined) updateData.onboardingStep = args.onboardingStep;
    if (args.isOnboardingComplete !== undefined) updateData.isOnboardingComplete = args.isOnboardingComplete;

    await ctx.db.patch(user._id, updateData);
    
    return user._id;
  },
});

// ========================================
// LEGACY USER MANAGEMENT (Updated for Clerk)
// ========================================

/**
 * Creates a new user manually (admin-only operation).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.name - The user's display name
 * @param {string} args.email - The user's email address
 * @param {"admin" | "lawyer" | "assistant"} args.role - The user's role in the system
 * @param {string} [args.clerkId] - Optional Clerk ID for integration
 * @returns {Promise<string>} The created user's document ID
 * @throws {Error} When not authenticated or not an admin
 * 
 * @description This function allows administrators to manually create user accounts,
 * typically for system setup or special cases. Manual users skip the onboarding
 * process by default. This should be used sparingly as most users should be created
 * through the Clerk authentication flow.
 * 
 * @example
 * ```javascript
 * const userId = await createUser({
 *   name: "System Admin",
 *   email: "admin@lawfirm.com",
 *   role: "admin"
 * });
 * ```
 */
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("lawyer"), v.literal("assistant")),
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Only admins can create users manually
    await requireAdmin(ctx);
    
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId || `manual_${Date.now()}`, // Fallback for manual creation
      name: args.name,
      email: args.email,
      role: args.role,
      isActive: true,
      isOnboardingComplete: args.clerkId ? false : true, // Manual users skip onboarding
      onboardingStep: args.clerkId ? 1 : undefined,
    });
    
    console.log("Created user with id:", userId);
    return userId;
  },
});

/**
 * Retrieves all users with optional filtering by active status.
 * 
 * @param {Object} args - The function arguments
 * @param {boolean} [args.isActive] - Filter by active status (optional)
 * @returns {Promise<Object[]>} Array of user documents
 * @throws {Error} When not authenticated or not an admin
 * 
 * @description This admin-only function returns all users in the system.
 * Use the isActive filter to get only active or inactive users, or omit
 * it to get all users regardless of status.
 * 
 * @example
 * ```javascript
 * // Get all active users
 * const activeUsers = await getUsers({ isActive: true });
 * 
 * // Get all users
 * const allUsers = await getUsers({});
 * ```
 */
export const getUsers = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Only admins can view all users
    await requireAdmin(ctx);
    
    if (args.isActive !== undefined) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_active_status", (q) => q.eq("isActive", args.isActive!))
        .collect();
      return users;
    } else {
      const users = await ctx.db.query("users").collect();
      return users;
    }
  },
}); 

/**
 * Retrieves users who have not completed the onboarding process.
 * 
 * @returns {Promise<Object[]>} Array of user documents with incomplete onboarding
 * @throws {Error} When not authenticated or not an admin
 * 
 * @description This admin-only function helps administrators track which users
 * need assistance with onboarding or may have abandoned the process. Useful for
 * user engagement and system administration.
 * 
 * @example
 * ```javascript
 * const incompleteUsers = await getUsersNeedingOnboarding();
 * console.log(`${incompleteUsers.length} users need onboarding assistance`);
 * ```
 */
// Get users who need to complete onboarding
export const getUsersNeedingOnboarding = query({
  args: {},
  handler: async (ctx) => {
    // Only admins can view onboarding status
    await requireAdmin(ctx);
    
    const users = await ctx.db
      .query("users")
      .withIndex("by_onboarding_status", (q) => q.eq("isOnboardingComplete", false))
      .collect();
    return users;
  },
}); 