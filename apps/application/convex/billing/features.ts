import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { PLAN_LIMITS, PlanType } from "./planLimits";
import { internal } from "../_generated/api";

/**
 * Internal helper to get user plan - used by both queries and mutations
 */
async function _getUserPlan(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<PlanType> {
  // First, find the Stripe customer for this user
  const customer = await ctx.db
    .query("stripeCustomers")
    .withIndex("byEntityId", (q) => q.eq("entityId", userId))
    .first();

  if (!customer) return "free";

  // Now query subscriptions using the Stripe customer ID
  const subscriptions = await ctx.db
    .query("stripeSubscriptions")
    .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
    .collect();

  // Filter for active subscriptions
  const activeSubscription = subscriptions.find((sub) => sub.stripe?.status === "active");
  
  if (!activeSubscription) return "free";

  // Get the first item's price ID from the Stripe object
  const priceId = activeSubscription.stripe?.items?.data?.[0]?.price?.id;
  if (!priceId) return "free";

  // Find the price in stripePrices table
  const price = await ctx.db
    .query("stripePrices")
    .withIndex("byPriceId", (q) => q.eq("priceId", priceId))
    .first();
  
  if (!price) return "free";

  // Get the product ID from the price
  const productId = price.stripe.productId;
  if (!productId) return "free";

  // Find the product - no index for productId, so use filter
  const product = await ctx.db
    .query("stripeProducts")
    .filter((q) => q.eq(q.field("productId"), productId))
    .first();
  
  if (!product) return "free";

  // Check product metadata for plan type
  const plan = product.stripe?.metadata?.plan;
  if (plan === "premium_individual") return "premium_individual";
  if (plan === "premium_team") return "premium_team";

  return "free";
}

/**
 * Get the current plan for a user by checking their Stripe subscription
 */
export const getUserPlan = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.literal("free"),
    v.literal("premium_individual"),
    v.literal("premium_team")
  ),
  handler: async (ctx, args): Promise<PlanType> => {
    return await _getUserPlan(ctx, args.userId);
  },
});

/**
 * Get the plan for a team
 * 
 * HYBRID MODEL:
 * 1. First checks if team itself has a premium_team subscription
 * 2. Falls back to team owner's subscription (premium_individual)
 * 3. This allows individual teams to be upgraded independently
 */
export const getTeamPlan = internalQuery({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.literal("free"),
    v.literal("premium_individual"),
    v.literal("premium_team")
  ),
  handler: async (ctx, args): Promise<PlanType> => {
    // Get team to find creator
    const team = await ctx.db.get(args.teamId);
    if (!team) return "free";

    // First, check if the TEAM itself has a subscription
    const teamCustomer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.teamId))
      .first();

    if (teamCustomer) {
      // Team has its own Stripe customer, check for active subscription
      const teamSubscriptions = await ctx.db
        .query("stripeSubscriptions")
        .withIndex("byCustomerId", (q) => q.eq("customerId", teamCustomer.customerId))
        .collect();

      const activeTeamSub = teamSubscriptions.find((sub) => sub.stripe?.status === "active");
      
      if (activeTeamSub) {
        // Team has active subscription - get product metadata
        const priceId = activeTeamSub.stripe?.items?.data?.[0]?.price?.id;
        if (priceId) {
          const price = await ctx.db
            .query("stripePrices")
            .withIndex("byPriceId", (q) => q.eq("priceId", priceId))
            .first();
          
          if (price) {
            const product = await ctx.db
              .query("stripeProducts")
              .filter((q) => q.eq(q.field("productId"), price.stripe.productId))
              .first();
            
            if (product?.stripe?.metadata?.plan === "premium_team") {
              return "premium_team";
            }
          }
        }
      }
    }

    // No team subscription found, fall back to owner's plan
    return await _getUserPlan(ctx, team.createdBy);
  },
});

/**
 * Check if a user has access to a specific feature
 * Supports both personal and team contexts
 */
export const hasFeatureAccess = internalQuery({
  args: {
    userId: v.id("users"),
    feature: v.string(),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ allowed: boolean; reason?: string }> => {
    let plan: PlanType;

    // Determine which plan to check based on context
    if (args.teamId) {
      // Team context: use team owner's plan
      const team = await ctx.db.get(args.teamId);
      if (!team) {
        plan = "free";
      } else {
        plan = await _getUserPlan(ctx, team.createdBy);
      }
    } else {
      // Personal context: use user's own plan
      plan = await _getUserPlan(ctx, args.userId);
    }

    const limits = PLAN_LIMITS[plan];

    // Premium users have full access
    if (plan === "premium_individual" || plan === "premium_team") {
      return { allowed: true };
    }

    // Free users: check feature flags first
    switch (args.feature) {
      case "create_team":
        if (!limits.features.createTeam) {
          return {
            allowed: false,
            reason: "Solo usuarios Premium pueden crear equipos.",
          };
        }
        break;

      case "gpt5_access":
        if (!limits.features.gpt5) {
          return {
            allowed: false,
            reason: "GPT-5 solo disponible en plan Premium.",
          };
        }
        break;

      case "team_library":
        if (!limits.features.teamLibrary) {
          return {
            allowed: false,
            reason: "Biblioteca de equipo solo en plan Premium.",
          };
        }
        break;
    }

    // Check usage limits for free users
    const usage = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.userId))
      .first();

    if (!usage) {
      // No usage record yet, allow (will be created on first use)
      return { allowed: true };
    }

    // Check specific feature limits
    switch (args.feature) {
      case "create_case":
        if (usage.casesCount >= limits.cases) {
          return {
            allowed: false,
            reason: `Plan gratuito limitado a ${limits.cases} casos. Actualiza a Premium.`,
          };
        }
        break;

      case "upload_document":
        if (usage.documentsCount >= limits.documentsPerCase) {
          return {
            allowed: false,
            reason: `Plan gratuito limitado a ${limits.documentsPerCase} documentos por caso.`,
          };
        }
        break;

      case "ai_message": {
        // Check monthly messages + purchased credits
        const credits = await ctx.db
          .query("aiCredits")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .first();

        const availableMessages =
          limits.aiMessagesPerMonth - usage.aiMessagesThisMonth;
        const availableCredits = credits?.remaining || 0;
        const totalAvailable = availableMessages + availableCredits;

        if (totalAvailable <= 0) {
          return {
            allowed: false,
            reason:
              "Límite de mensajes alcanzado. Compra créditos o actualiza a Premium.",
          };
        }
        break;
      }

      case "create_escrito":
        if (usage.escritosCount >= limits.escritosPerCase) {
          return {
            allowed: false,
            reason: `Plan gratuito limitado a ${limits.escritosPerCase} escritos por caso.`,
          };
        }
        break;
    }

    return { allowed: true };
  },
});

/**
 * Increment a usage counter for an entity (user or team)
 */
export const incrementUsage = internalMutation({
  args: {
    entityId: v.string(),
    counter: v.union(
      v.literal("casesCount"),
      v.literal("documentsCount"),
      v.literal("aiMessagesThisMonth"),
      v.literal("escritosCount"),
      v.literal("libraryDocumentsCount"),
      v.literal("storageUsedBytes")
    ),
    amount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();

    if (!limits) {
      throw new Error("Límites de uso no encontrados");
    }

    const increment = args.amount || 1;

    await ctx.db.patch(limits._id, {
      [args.counter]: limits[args.counter] + increment,
    });

    return null;
  },
});

/**
 * Decrement AI credits for a user
 * Uses free monthly messages first, then purchased credits
 */
export const decrementCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const amount = args.amount || 1;

    // Check monthly limits first
    const usage = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.userId))
      .first();

    if (!usage) {
      throw new Error("Límites de uso no encontrados");
    }

    // Get user's plan to check monthly limit
    const plan = await _getUserPlan(ctx, args.userId);
    const monthlyLimit = PLAN_LIMITS[plan].aiMessagesPerMonth;

    // If within monthly limit, just increment counter
    if (usage.aiMessagesThisMonth < monthlyLimit) {
      await ctx.db.patch(usage._id, {
        aiMessagesThisMonth: usage.aiMessagesThisMonth + amount,
      });
      return null;
    }

    // Otherwise, use purchased credits
    const credits = await ctx.db
      .query("aiCredits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!credits || credits.remaining < amount) {
      throw new Error("Créditos insuficientes");
    }

    await ctx.db.patch(credits._id, {
      used: credits.used + amount,
      remaining: credits.remaining - amount,
      lastUpdated: Date.now(),
    });

    return null;
  },
});

/**
 * Reset monthly usage counters
 * Should be called at the start of each billing period
 */
export const resetMonthlyCounters = internalMutation({
  args: { entityId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();

    if (!limits) return null;

    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Only reset if a month has passed
    if (limits.currentMonthStart < oneMonthAgo) {
      await ctx.db.patch(limits._id, {
        aiMessagesThisMonth: 0,
        currentMonthStart: now,
        lastResetDate: now,
      });
    }

    return null;
  },
});

/**
 * Check if a team can add more members based on its subscription
 */
export const canAddTeamMember = internalQuery({
  args: { 
    teamId: v.id("teams"),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    currentCount: v.number(),
    maxAllowed: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount: number;
    maxAllowed: number;
  }> => {
    // Get team's plan
    const plan = await ctx.db.get(args.teamId);
    if (!plan) {
      return {
        allowed: false,
        reason: "Equipo no encontrado",
        currentCount: 0,
        maxAllowed: 0,
      };
    }

    // Get team's subscription level
    const teamPlan = await ctx.runQuery(internal.billing.features.getTeamPlan, {
      teamId: args.teamId,
    });

    const limits = PLAN_LIMITS[teamPlan];
    
    // Count current team members
    const currentMembers = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const currentCount = currentMembers.length;
    const maxAllowed = limits.teamMembers;

    if (currentCount >= maxAllowed) {
      return {
        allowed: false,
        reason: teamPlan === "premium_individual" 
          ? `Límite de 3 miembros alcanzado. Actualiza a Premium Equipo para 6 miembros.`
          : `Límite de miembros alcanzado.`,
        currentCount,
        maxAllowed,
      };
    }

    return {
      allowed: true,
      currentCount,
      maxAllowed,
    };
  },
});

/**
 * Get current usage limits for a user or team
 * Used for dashboard display
 */
export const getUsageLimits = internalQuery({
  args: { entityId: v.string() },
  returns: v.union(
    v.object({
      entityId: v.string(),
      entityType: v.union(v.literal("user"), v.literal("team")),
      casesCount: v.number(),
      documentsCount: v.number(),
      aiMessagesThisMonth: v.number(),
      escritosCount: v.number(),
      libraryDocumentsCount: v.number(),
      storageUsedBytes: v.number(),
      lastResetDate: v.number(),
      currentMonthStart: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();

    if (!limits) return null;

    return {
      entityId: limits.entityId,
      entityType: limits.entityType,
      casesCount: limits.casesCount,
      documentsCount: limits.documentsCount,
      aiMessagesThisMonth: limits.aiMessagesThisMonth,
      escritosCount: limits.escritosCount,
      libraryDocumentsCount: limits.libraryDocumentsCount,
      storageUsedBytes: limits.storageUsedBytes,
      lastResetDate: limits.lastResetDate,
      currentMonthStart: limits.currentMonthStart,
    };
  },
});

