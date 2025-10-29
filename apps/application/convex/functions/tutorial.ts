import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get the tutorial progress for the current user
 */
export const getTutorialProgress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return progress;
  },
});

/**
 * Initialize tutorial progress for a user
 */
export const initializeTutorial = mutation({
  args: {
    startOnPage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if progress already exists
    const existingProgress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existingProgress) {
      // Reset existing progress
      await ctx.db.patch(existingProgress._id, {
        isActive: true,
        isCompleted: false,
        currentPage: args.startOnPage || "home",
        currentStepId: undefined,
        completedSteps: [],
        skippedPages: [],
        lastUpdatedAt: now,
        completedAt: undefined,
      });

      return existingProgress._id;
    } else {
      // Create new progress
      const progressId = await ctx.db.insert("tutorialProgress", {
        userId: user._id,
        isActive: true,
        isCompleted: false,
        currentPage: args.startOnPage || "home",
        currentStepId: undefined,
        completedSteps: [],
        skippedPages: [],
        startedAt: now,
        lastUpdatedAt: now,
      });

      return progressId;
    }
  },
});

/**
 * Update the current step in the tutorial
 */
export const updateCurrentStep = mutation({
  args: {
    stepId: v.string(),
    page: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error(
        "Tutorial progress not found. Please initialize tutorial first.",
      );
    }

    // Update current step and page
    await ctx.db.patch(progress._id, {
      currentStepId: args.stepId,
      currentPage: args.page,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Mark a step as completed
 */
export const completeStep = mutation({
  args: {
    stepId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error("Tutorial progress not found");
    }

    // Add step to completed steps if not already there
    if (!progress.completedSteps.includes(args.stepId)) {
      await ctx.db.patch(progress._id, {
        completedSteps: [...progress.completedSteps, args.stepId],
        lastUpdatedAt: Date.now(),
      });
    }
  },
});

/**
 * Skip a page in the tutorial
 */
export const skipPage = mutation({
  args: {
    page: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error("Tutorial progress not found");
    }

    // Add page to skipped pages if not already there
    if (!progress.skippedPages.includes(args.page)) {
      await ctx.db.patch(progress._id, {
        skippedPages: [...progress.skippedPages, args.page],
        lastUpdatedAt: Date.now(),
      });
    }
  },
});

/**
 * Complete the entire tutorial
 */
export const completeTutorial = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error("Tutorial progress not found");
    }

    // Mark tutorial as completed and inactive
    await ctx.db.patch(progress._id, {
      isCompleted: true,
      isActive: false,
      completedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Dismiss/hide the tutorial
 */
export const dismissTutorial = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error("Tutorial progress not found");
    }

    // Mark tutorial as inactive (but not completed)
    await ctx.db.patch(progress._id, {
      isActive: false,
      lastUpdatedAt: Date.now(),
    });
  },
});

/**
 * Reactivate the tutorial
 */
export const reactivateTutorial = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get tutorial progress
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) {
      throw new Error("Tutorial progress not found");
    }

    // Reactivate tutorial
    await ctx.db.patch(progress._id, {
      isActive: true,
      lastUpdatedAt: Date.now(),
    });
  },
});
