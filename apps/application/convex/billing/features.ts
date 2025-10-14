import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { PLAN_LIMITS, PlanType } from "./planLimits";

/**
 * Internal helper to get user plan - used by both queries and mutations
 * EXPORTED for use in other files
 */
export async function _getUserPlan(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<PlanType> {
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
 * Internal helper to get team plan - used by both queries and mutations
 * EXPORTED for use in other files
 */
export async function _getTeamPlan(ctx: QueryCtx | MutationCtx, teamId: Id<"teams">): Promise<PlanType> {
  // Get team to find creator
  const team = await ctx.db.get(teamId);
  if (!team) return "free";

  // First, check if the TEAM itself has a subscription
  const teamCustomer = await ctx.db
    .query("stripeCustomers")
    .withIndex("byEntityId", (q) => q.eq("entityId", teamId))
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
}

/**
 * Internal helper to get or create usage limits for an entity
 * EXPORTED for use in other files
 * 
 * This function gracefully handles missing usageLimits records by creating them
 * with default values. This is essential for:
 * - New users/teams that don't have limits initialized yet
 * - Existing users created before the billing system
 * - Migration scenarios
 */
export async function _getOrCreateUsageLimits(
  ctx: MutationCtx,
  entityId: string,
  entityType: "user" | "team"
) {
  let usage = await ctx.db
    .query("usageLimits")
    .withIndex("by_entity", (q) => q.eq("entityId", entityId))
    .first();

  if (!usage) {
    // Create usage limits with default values
    const usageId = await ctx.db.insert("usageLimits", {
      entityId,
      entityType,
      casesCount: 0,
      documentsCount: 0,
      aiMessagesThisMonth: 0,
      escritosCount: 0,
      libraryDocumentsCount: 0,
      storageUsedBytes: 0,
      currentMonthStart: Date.now(),
      lastResetDate: Date.now(),
    });
    usage = await ctx.db.get(usageId);
  }

  return usage!;
}

/**
 * Internal helper to increment usage counters
 * EXPORTED for use in other files
 */
export async function _incrementUsage(
  ctx: MutationCtx,
  args: {
    entityId: string;
    entityType: "user" | "team";
    counter: "casesCount" | "documentsCount" | "aiMessagesThisMonth" | "escritosCount" | "libraryDocumentsCount" | "storageUsedBytes";
    amount?: number;
  }
): Promise<void> {
  // Use helper to get or create limits
  const limits = await _getOrCreateUsageLimits(ctx, args.entityId, args.entityType);

  const increment = args.amount || 1;

  await ctx.db.patch(limits._id, {
    [args.counter]: limits[args.counter] + increment,
  });
}

/**
 * Internal helper to determine which AI model a user should use
 * EXPORTED for use in other files
 * 
 * Returns 'o1' (GPT-5) if:
 * - User has premium_individual or premium_team subscription
 * - User is a member of a team with premium_team subscription
 * 
 * Otherwise returns 'gpt-4o'
 */
export async function _getModelForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<'gpt-5' | 'gpt-4o'> {
  // 1. Check user's own plan
  const userPlan = await _getUserPlan(ctx, userId);
  if (userPlan === "premium_individual" || userPlan === "premium_team") {
    return "gpt-5"; // GPT-5
  }

  // 2. User is free - check if they're a member of any premium_team
  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  // 3. For each team, check if it has premium_team subscription
  for (const membership of teamMemberships) {
    const teamPlan = await _getTeamPlan(ctx, membership.teamId);
    if (teamPlan === "premium_team") {
      return "gpt-5"; // GPT-5
    }
  }

  // 4. No access to GPT-5
  return "gpt-4o";
}

/**
 * Determines which entity (user or team) should be billed for an action
 * Based on business rules:
 * - If teamId provided, use team limits
 * - Otherwise use user's personal limits
 * EXPORTED for use in other files
 */
export async function _getBillingEntity(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    teamId?: Id<"teams">;
  }
): Promise<{
  entityId: string;
  entityType: "user" | "team";
  plan: PlanType;
}> {
  if (args.teamId) {
    const plan = await _getTeamPlan(ctx, args.teamId);
    return {
      entityId: args.teamId,
      entityType: "team",
      plan,
    };
  }
  
  const plan = await _getUserPlan(ctx, args.userId);
  return {
    entityId: args.userId,
    entityType: "user",
    plan,
  };
}

/**
 * Checks if an action is allowed based on billing limits
 * Throws detailed error if limit exceeded
 * EXPORTED for use in other files
 */
export async function _checkLimit(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    teamId?: Id<"teams">;
    limitType: "cases" | "documentsPerCase" | "escritosPerCase" | "libraryDocuments" | "storageGB";
    currentCount?: number; // For per-case limits
    additionalBytes?: number; // For storage checks
  }
): Promise<void> {
  const billing = await _getBillingEntity(ctx, { userId: args.userId, teamId: args.teamId });
  const limits = PLAN_LIMITS[billing.plan];
  
  // For queries, we need to handle the readonly context
  // We'll try to get usage, but won't create it if it doesn't exist in query context
  let usage;
  if ('db' in ctx && 'scheduler' in ctx) {
    // MutationCtx - can create usage limits
    usage = await _getOrCreateUsageLimits(ctx as MutationCtx, billing.entityId, billing.entityType);
  } else {
    // QueryCtx - can only read usage limits
    usage = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", billing.entityId))
      .first();
    
    if (!usage) {
      // No usage record yet, allow (will be created on first use)
      return;
    }
  }
  
  // Check specific limit type
  switch (args.limitType) {
    case "cases":
      if (usage.casesCount >= limits.cases) {
        throw new Error(
          `Límite de ${limits.cases} casos alcanzado. Actualiza a Premium para casos ilimitados.`
        );
      }
      break;
    
    case "documentsPerCase":
      if (args.currentCount !== undefined && args.currentCount >= limits.documentsPerCase) {
        throw new Error(
          `Límite de ${limits.documentsPerCase} documentos por caso alcanzado.`
        );
      }
      break;
    
    case "escritosPerCase":
      if (args.currentCount !== undefined && args.currentCount >= limits.escritosPerCase) {
        throw new Error(
          `Límite de ${limits.escritosPerCase} escritos por caso alcanzado.`
        );
      }
      break;
    
    case "libraryDocuments":
      // Count library docs for this entity
      const libDocs = await ctx.db
        .query("libraryDocuments")
        .filter((q) => 
          billing.entityType === "team"
            ? q.eq(q.field("teamId"), billing.entityId as Id<"teams">)
            : q.eq(q.field("createdBy"), billing.entityId as Id<"users">)
        )
        .collect();
      
      if (libDocs.length >= limits.libraryDocuments) {
        throw new Error(
          `Límite de ${limits.libraryDocuments} documentos de biblioteca alcanzado.`
        );
      }
      break;
    
    case "storageGB":
      const storageLimitBytes = limits.storageGB * 1024 * 1024 * 1024;
      const newTotal = usage.storageUsedBytes + (args.additionalBytes || 0);
      
      if (newTotal > storageLimitBytes) {
        const availableGB = (storageLimitBytes - usage.storageUsedBytes) / (1024 * 1024 * 1024);
        throw new Error(
          `Espacio insuficiente. Disponible: ${availableGB.toFixed(2)}GB.`
        );
      }
      break;
  }
}

/**
 * Internal helper to check if a team can add members
 * EXPORTED for use in other files
 */
export async function _canAddTeamMember(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
): Promise<{
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
}> {
  // Get team's plan
  const plan = await ctx.db.get(teamId);
  if (!plan) {
    return {
      allowed: false,
      reason: "Equipo no encontrado",
      currentCount: 0,
      maxAllowed: 0,
    };
  }

  // Get team's subscription level using helper
  const teamPlan = await _getTeamPlan(ctx, teamId);

  const limits = PLAN_LIMITS[teamPlan];
  
  // Count current team members
  const currentMembers = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
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
}

/**
 * Get the current plan for a user by checking their Stripe subscription
 */
export const getUserPlan = query({
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
    return await _getTeamPlan(ctx, args.teamId);
  },
});

/**
 * Check if a user has access to a specific feature
 * Supports both personal and team contexts
 */
export const hasFeatureAccess = query({
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
    const billing = await _getBillingEntity(ctx, { userId: args.userId, teamId: args.teamId });
    const limits = PLAN_LIMITS[billing.plan];

    // Premium users have full access
    if (billing.plan === "premium_individual" || billing.plan === "premium_team") {
      return { allowed: true };
    }

    // Free users: check feature flags
    switch (args.feature) {
      case "create_team":
        if (!limits.features.createTeam) {
          return { allowed: false, reason: "Solo usuarios Premium pueden crear equipos." };
        }
        break;

      case "gpt5_access":
        if (!limits.features.gpt5) {
          return { allowed: false, reason: "GPT-5 solo disponible en plan Premium." };
        }
        break;

      case "team_library":
        if (!limits.features.teamLibrary) {
          return { allowed: false, reason: "Biblioteca de equipo solo en plan Premium." };
        }
        break;
    }

    // Check usage limits using correct entity
    const usage = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", billing.entityId))
      .first();

    if (!usage) {
      // No usage record yet, allow (will be created on first use)
      return { allowed: true };
    }

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
        const credits = await ctx.db
          .query("aiCredits")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .first();

        const availableMessages = limits.aiMessagesPerMonth - usage.aiMessagesThisMonth;
        const availableCredits = credits?.remaining || 0;
        const totalAvailable = availableMessages + availableCredits;

        if (totalAvailable <= 0) {
          return {
            allowed: false,
            reason: "Límite de mensajes alcanzado. Compra créditos o actualiza a Premium.",
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
 * Get the appropriate AI model for a user based on their billing plan
 * Internal mutation wrapper for _getModelForUser
 */
export const getModelForUserMutation = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(v.literal("gpt-5"), v.literal("gpt-4o")),
  handler: async (ctx, args): Promise<'gpt-5' | 'gpt-4o'> => {
    return await _getModelForUser(ctx, args.userId);
  },
});

/**
 * Increment a usage counter for an entity (user or team)
 */
export const incrementUsage = internalMutation({
  args: {
    entityId: v.string(),
    entityType: v.union(v.literal("user"), v.literal("team")),
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
    await _incrementUsage(ctx, args);
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
    teamId: v.optional(v.id("teams")),
    amount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const amount = args.amount || 1;
    
    // Get billing entity
    const billing = await _getBillingEntity(ctx, {
      userId: args.userId,
      teamId: args.teamId,
    });
    
    const limits = PLAN_LIMITS[billing.plan];
    const usage = await _getOrCreateUsageLimits(ctx, billing.entityId, billing.entityType);

    // If within monthly limit, increment counter
    if (usage.aiMessagesThisMonth < limits.aiMessagesPerMonth) {
      await ctx.db.patch(usage._id, {
        aiMessagesThisMonth: usage.aiMessagesThisMonth + amount,
      });
      return null;
    }

    // Otherwise use purchased credits (user-level only)
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
export const canAddTeamMember = query({
  args: { 
    teamId: v.id("teams"),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    currentCount: v.number(),
    maxAllowed: v.number(),
  }),
  handler: async (ctx, args) => {
    return await _canAddTeamMember(ctx, args.teamId);
  },
});

/**
 * Get current usage limits for a user or team
 * Used for dashboard display
 */
export const getUsageLimits = query({
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

