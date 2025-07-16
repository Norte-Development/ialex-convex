import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireAuth, requireAdmin } from "./auth_utils";

// ========================================
// CLERK USER SYNC FUNCTIONS
// ========================================

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