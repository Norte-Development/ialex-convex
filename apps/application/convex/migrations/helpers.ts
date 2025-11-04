/**
 * Migration Helper Functions
 * 
 * These functions provide common utilities for the Kinde to Clerk migration process.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Get count of user data across all tables
 * Used to determine merge strategy for conflicting users
 */
export const getUserDataCount = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    casesCount: v.number(),
    documentsCount: v.number(),
    clientsCount: v.number(),
    escritosCount: v.number(),
    totalCount: v.number(),
  }),
  handler: async (ctx, { userId }) => {
    // Count cases created by this user
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    // Count documents created by this user
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    // Count clients created by this user
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    // Count escritos created by this user
    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    const casesCount = cases.length;
    const documentsCount = documents.length;
    const clientsCount = clients.length;
    const escritosCount = escritos.length;

    return {
      casesCount,
      documentsCount,
      clientsCount,
      escritosCount,
      totalCount: casesCount + documentsCount + clientsCount + escritosCount,
    };
  },
});

/**
 * Get user by email
 */
export const getByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
      isActive: v.boolean(),
      isOnboardingComplete: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      isOnboardingComplete: user.isOnboardingComplete,
    };
  },
});

/**
 * Get all users (for migration purposes only)
 * Returns minimal user info for conflict detection
 */
export const getAllUsers = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      clerkId: v.string(),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      clerkId: user.clerkId,
    }));
  },
});

/**
 * Add migration metadata to an existing user
 * Used when merging a Kinde user with an existing Convex user
 */
export const addMigrationMetadata = internalMutation({
  args: {
    userId: v.id("users"),
    oldKindeId: v.string(),
    migrationStatus: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, { userId, oldKindeId, migrationStatus }) => {
    // Note: This will cause a type error until migration is added to the schema
    // See README.md for instructions on adding migration to schema.ts
    await ctx.db.patch(userId, {
      migration: {
        status: migrationStatus,
        oldKindeId,
        consentGiven: false,
      },
    } as any);

    console.log(`Added migration metadata to user ${userId}: Kinde ID ${oldKindeId}, status ${migrationStatus}`);
    return null;
  },
});

/**
 * Create a minimal user stub for migration
 * Used when creating new Clerk users from Kinde
 */
export const createMigrationStub = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    isActive: v.boolean(),
    isOnboardingComplete: v.boolean(),
    migration: v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("failed")
      ),
      oldKindeId: v.string(),
      consentGiven: v.boolean(),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists with this email
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      console.log(`User with email ${args.email} already exists. Returning existing user ID.`);
      return existingUser._id;
    }

    // Create new user with migration metadata
    // Note: This will cause a type error until migration is added to the schema
    // See README.md for instructions on adding migration to schema.ts
    const userId: Id<"users"> = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: args.isActive,
      isOnboardingComplete: args.isOnboardingComplete,
      migration: args.migration,
    } as any);

    console.log(`Created migration stub for user ${args.email} with ID ${userId}`);
    return userId;
  },
});

/**
 * Update user migration status
 */
export const updateMigrationStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    consentGiven: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, status, consentGiven }) => {
    const user = await ctx.db.get(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const currentMigration = (user as any).migration || {};

    // Note: This will cause a type error until migration is added to the schema
    // See README.md for instructions on adding migration to schema.ts
    await ctx.db.patch(userId, {
      migration: {
        ...currentMigration,
        status,
        ...(consentGiven !== undefined && { consentGiven }),
      },
    } as any);

    console.log(`Updated migration status for user ${userId} to ${status}`);
    return null;
  },
});

/**
 * Get user migration status
 */
export const getMigrationStatus = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      status: v.string(),
      oldKindeId: v.string(),
      consentGiven: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    
    if (!user) {
      return null;
    }

    const migration = (user as any).migration;
    
    if (!migration) {
      return null;
    }

    return {
      status: migration.status,
      oldKindeId: migration.oldKindeId,
      consentGiven: migration.consentGiven,
    };
  },
});
