import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Admin functions for managing MercadoPago subscriptions manually
 * These are internal functions that should only be called by admins
 */

// Get all MercadoPago subscriptions
export const getAllMercadoPagoSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db
      .query("mercadopagoSubscriptions")
      .collect();

    // Get user details for each subscription
    const subscriptionsWithUsers = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await ctx.db.get(sub.userId);
        return {
          ...sub,
          user: user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
          } : null,
        };
      })
    );

    return subscriptionsWithUsers;
  },
});

// Get MercadoPago subscription by user ID
export const getMercadoPagoSubscriptionByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const subscription = await ctx.db
      .query("mercadopagoSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!subscription) return null;

    const user = await ctx.db.get(userId);
    return {
      ...subscription,
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
      } : null,
    };
  },
});

// Create a new MercadoPago subscription (admin only)
export const createMercadoPagoSubscription = mutation({
  args: {
    userId: v.id("users"),
    mpSubscriptionId: v.string(),
    mpCustomerId: v.string(),
    plan: v.union(
      v.literal("premium_individual"),
      v.literal("premium_team"),
      v.literal("enterprise")
    ),
    amount: v.number(),
    currency: v.string(),
    billingCycle: v.union(
      v.literal("monthly"),
      v.literal("yearly")
    ),
    startDate: v.number(),
    nextBillingDate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already has a subscription
    const existing = await ctx.db
      .query("mercadopagoSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("User already has a MercadoPago subscription");
    }

    const subscriptionId = await ctx.db.insert("mercadopagoSubscriptions", {
      userId: args.userId,
      mpSubscriptionId: args.mpSubscriptionId,
      mpCustomerId: args.mpCustomerId,
      plan: args.plan,
      status: "active",
      amount: args.amount,
      currency: args.currency,
      billingCycle: args.billingCycle,
      startDate: args.startDate,
      nextBillingDate: args.nextBillingDate,
      lastUpdatedBy: args.userId, // TODO: Get actual admin user ID
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return subscriptionId;
  },
});

// Update MercadoPago subscription status (admin only)
export const updateMercadoPagoSubscriptionStatus = mutation({
  args: {
    subscriptionId: v.id("mercadopagoSubscriptions"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const updateData: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    // If cancelling, set end date
    if (args.status === "cancelled" || args.status === "expired") {
      updateData.endDate = Date.now();
    }

    // Add notes if provided
    if (args.notes) {
      updateData.notes = args.notes;
    }

    await ctx.db.patch(args.subscriptionId, updateData);
  },
});

// Update next billing date (admin only)
export const updateMercadoPagoBillingDate = mutation({
  args: {
    subscriptionId: v.id("mercadopagoSubscriptions"),
    nextBillingDate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const updateData: any = {
      nextBillingDate: args.nextBillingDate,
      updatedAt: Date.now(),
    };

    if (args.notes) {
      updateData.notes = args.notes;
    }

    await ctx.db.patch(args.subscriptionId, updateData);
  },
});

// Delete MercadoPago subscription (admin only)
export const deleteMercadoPagoSubscription = mutation({
  args: { subscriptionId: v.id("mercadopagoSubscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    await ctx.db.delete(args.subscriptionId);
  },
});

// Get subscription statistics for admin dashboard
export const getMercadoPagoStats = query({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db
      .query("mercadopagoSubscriptions")
      .collect();

    const stats = {
      total: subscriptions.length,
      active: subscriptions.filter(s => s.status === "active").length,
      paused: subscriptions.filter(s => s.status === "paused").length,
      cancelled: subscriptions.filter(s => s.status === "cancelled").length,
      expired: subscriptions.filter(s => s.status === "expired").length,
      monthlyRevenue: subscriptions
        .filter(s => s.status === "active" && s.billingCycle === "monthly")
        .reduce((sum, s) => sum + s.amount, 0),
      yearlyRevenue: subscriptions
        .filter(s => s.status === "active" && s.billingCycle === "yearly")
        .reduce((sum, s) => sum + s.amount, 0),
      byPlan: {
        premium_individual: subscriptions.filter(s => s.plan === "premium_individual").length,
        premium_team: subscriptions.filter(s => s.plan === "premium_team").length,
        enterprise: subscriptions.filter(s => s.plan === "enterprise").length,
      },
    };

    return stats;
  },
});

// Get subscriptions expiring soon (next 7 days)
export const getExpiringSoon = query({
  args: {},
  handler: async (ctx) => {
    const sevenDaysFromNow = Date.now() + (7 * 24 * 60 * 60 * 1000);
    
    const expiringSoon = await ctx.db
      .query("mercadopagoSubscriptions")
      .withIndex("by_next_billing", (q) => 
        q.lt("nextBillingDate", sevenDaysFromNow)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get user details for each subscription
    const expiringWithUsers = await Promise.all(
      expiringSoon.map(async (sub) => {
        const user = await ctx.db.get(sub.userId);
        return {
          ...sub,
          user: user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
          } : null,
        };
      })
    );

    return expiringWithUsers;
  },
});
