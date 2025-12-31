import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { PLAN_LIMITS, PlanType } from "./planLimits";

/**
 * Helper to detect if we're in development mode
 * Returns true if we should bypass plan limits
 */
function isDevMode(): boolean {
  // Option 1: Use an explicit environment variable (recommended)
  if (process.env.DISABLE_PLAN_LIMITS === "true") {
    return true;
  }

  // Option 2: Check if CONVEX_SITE_URL contains "dev"
  const siteUrl = process.env.CONVEX_SITE_URL || "";
  if (siteUrl.includes(".cloud-dev.") || siteUrl.includes("localhost")) {
    return true;
  }

  return false;
}

/**
 * Internal helper to get user plan - used by both queries and mutations
 * EXPORTED for use in other files
 */
export async function _getUserPlan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<PlanType> {
  // DEV MODE: If DISABLE_PLAN_LIMITS is true, treat all users as premium
  if (isDevMode()) {
    return "premium_individual";
  }

  // Get user for trial status check
  const user = await ctx.db.get(userId);

  // Check for MercadoPago subscription FIRST (manual management)
  const mpSubscription = await ctx.db
    .query("mercadopagoSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (mpSubscription) {
    // Mark trial as converted if user was in trial
    if (user?.trialStatus === "active" && "scheduler" in ctx) {
      await ctx.db.patch(userId, { trialStatus: "converted" });
    }
    return mpSubscription.plan as PlanType;
  }

  // Check for Stripe subscription (paid subscriptions take precedence over trials)
  const customer = await ctx.db
    .query("stripeCustomers")
    .withIndex("byEntityId", (q) => q.eq("entityId", userId))
    .first();

  if (customer) {
    // Query subscriptions using the Stripe customer ID
    const subscriptions = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
      .collect();

    // Filter for active subscriptions
    const activeSubscription = subscriptions.find(
      (sub) => sub.stripe?.status === "active",
    );

    if (activeSubscription) {
      // Get the first item's price ID from the Stripe object
      const priceId = activeSubscription.stripe?.items?.data?.[0]?.price?.id;

      if (priceId) {
        // Find the price in stripePrices table
        const price = await ctx.db
          .query("stripePrices")
          .withIndex("byPriceId", (q) => q.eq("priceId", priceId))
          .first();

        if (price) {
          // Get the product ID from the price
          const productId = price.stripe.productId;

          if (productId) {
            // Find the product - no index for productId, so use filter
            const product = await ctx.db
              .query("stripeProducts")
              .filter((q) => q.eq(q.field("productId"), productId))
              .first();

            if (product) {
              // Check product metadata for plan type
              const plan = product.stripe?.metadata?.plan;
              if (plan === "premium_individual") {
                // Mark trial as converted if user was in trial
                if (user?.trialStatus === "active" && "scheduler" in ctx) {
                  await ctx.db.patch(userId, { trialStatus: "converted" });
                }
                return "premium_individual";
              }
              if (plan === "premium_team") {
                // Mark trial as converted if user was in trial
                if (user?.trialStatus === "active" && "scheduler" in ctx) {
                  await ctx.db.patch(userId, { trialStatus: "converted" });
                }
                return "premium_team";
              }
            }
          }
        }
      }
    }
  }

  // No active paid subscription - check if user has ACTIVE trial
  if (
    user?.trialStatus === "active" &&
    user.trialEndDate &&
    user.trialEndDate > Date.now()
  ) {
    return user.trialPlan || "premium_individual";
  }

  // If trial expired but status not updated yet, mark as expired (only in mutation context)
  if (
    user?.trialStatus === "active" &&
    user.trialEndDate &&
    user.trialEndDate <= Date.now()
  ) {
    if ("scheduler" in ctx) {
      // MutationCtx - can update
      await ctx.db.patch(userId, { trialStatus: "expired" });
    }
  }

  return "free";
}

/**
 * Internal helper to get team plan - used by both queries and mutations
 * EXPORTED for use in other files
 *
 * SIMPLIFIED: Team plan is ALWAYS the owner's plan (no separate team subscriptions)
 */
export async function _getTeamPlan(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">,
): Promise<PlanType> {
  const team = await ctx.db.get(teamId);
  if (!team) return "free";

  // Team plan is always the owner's plan
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
  entityType: "user" | "team",
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
    counter:
      | "casesCount"
      | "documentsCount"
      | "aiMessagesThisMonth"
      | "escritosCount"
      | "libraryDocumentsCount"
      | "storageUsedBytes";
    amount?: number;
  },
): Promise<void> {
  // Use helper to get or create limits
  const limits = await _getOrCreateUsageLimits(
    ctx,
    args.entityId,
    args.entityType,
  );

  const increment = args.amount || 1;

  await ctx.db.patch(limits._id, {
    [args.counter]: limits[args.counter] + increment,
  });
}

/**
 * Internal helper to determine which AI model a user should use based ONLY on their personal plan
 * EXPORTED for use in other files
 *
 * Used for non-case contexts (e.g., home page assistant)
 * Only checks the user's personal subscription, NOT team memberships
 *
 * Returns:
 * - 'gpt-5' if user has premium_individual or premium_team subscription
 * - 'gpt-4o' otherwise (free users always get GPT-4o in non-case contexts)
 */
export async function _getModelForUserPersonal(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<"gpt-5" | "gpt-4o"> {
  const userPlan = await _getUserPlan(ctx, userId);
  if (userPlan === "premium_individual" || userPlan === "premium_team") {
    return "gpt-5";
  }
  return "gpt-4o";
}

/**
 * Internal helper to determine which AI model a user should use IN A SPECIFIC CASE CONTEXT
 * EXPORTED for use in other files
 *
 * Context-aware model selection:
 * - Premium users (individual/team) → GPT-5 everywhere
 * - Free users in personal cases → GPT-4o
 * - Free users in premium team cases → GPT-5 (only in that team's cases)
 *
 * This prevents free users from getting premium benefits globally if they're in one premium team
 */
export async function _getModelForUserInCase(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
): Promise<"gpt-5" | "gpt-4o"> {
  // 1. Check user's own plan first (premium users always get GPT-5)
  const userPlan = await _getUserPlan(ctx, userId);
  if (userPlan === "premium_individual" || userPlan === "premium_team") {
    return "gpt-5";
  }

  // 2. User is free - check if this specific case has premium team access
  const teamAccess = await ctx.db
    .query("caseAccess")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .filter((q) => q.neq(q.field("teamId"), undefined))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (!teamAccess?.teamId) {
    // Personal case - use free tier
    return "gpt-4o";
  }

  // 3. Verify user is actually a member of this team
  const membership = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("teamId"), teamAccess.teamId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) {
    // User not in this team - shouldn't happen with proper access control, but safety check
    return "gpt-4o";
  }

  // 4. Check if this team has premium_team plan
  const teamPlan = await _getTeamPlan(ctx, teamAccess.teamId);
  if (teamPlan === "premium_team") {
    return "gpt-5"; // ✅ GPT-5 only in this team's cases
  }

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
  },
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
    limitType:
      | "cases"
      | "documentsPerCase"
      | "escritosPerCase"
      | "libraryDocuments"
      | "storageGB";
    currentCount?: number; // For per-case limits
    additionalBytes?: number; // For storage checks
  },
): Promise<void> {
  // Skip limit checks in dev mode
  if (isDevMode()) {
    return;
  }

  const billing = await _getBillingEntity(ctx, {
    userId: args.userId,
    teamId: args.teamId,
  });
  const limits = PLAN_LIMITS[billing.plan];

  // For queries, we need to handle the readonly context
  // We'll try to get usage, but won't create it if it doesn't exist in query context
  let usage;
  if ("db" in ctx && "scheduler" in ctx) {
    // MutationCtx - can create usage limits
    usage = await _getOrCreateUsageLimits(
      ctx as MutationCtx,
      billing.entityId,
      billing.entityType,
    );
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
          `Límite de ${limits.cases} casos alcanzado. Actualiza a Premium para casos ilimitados.`,
        );
      }
      break;

    case "documentsPerCase":
      if (
        args.currentCount !== undefined &&
        args.currentCount >= limits.documentsPerCase
      ) {
        throw new Error(
          `Límite de ${limits.documentsPerCase} documentos por caso alcanzado.`,
        );
      }
      break;

    case "escritosPerCase":
      if (
        args.currentCount !== undefined &&
        args.currentCount >= limits.escritosPerCase
      ) {
        throw new Error(
          `Límite de ${limits.escritosPerCase} escritos por caso alcanzado.`,
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
            : q.eq(q.field("createdBy"), billing.entityId as Id<"users">),
        )
        .collect();

      if (libDocs.length >= limits.libraryDocuments) {
        throw new Error(
          `Límite de ${limits.libraryDocuments} documentos de biblioteca alcanzado.`,
        );
      }
      break;

    case "storageGB":
      const storageLimitBytes = limits.storageGB * 1024 * 1024 * 1024;
      const newTotal = usage.storageUsedBytes + (args.additionalBytes || 0);

      if (newTotal > storageLimitBytes) {
        const availableGB =
          (storageLimitBytes - usage.storageUsedBytes) / (1024 * 1024 * 1024);
        throw new Error(
          `Espacio insuficiente. Disponible: ${availableGB.toFixed(2)}GB.`,
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
  teamId: Id<"teams">,
): Promise<{
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxAllowed: number;
}> {
  // Allow unlimited members in dev mode
  if (isDevMode()) {
    const currentMembers = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      allowed: true,
      currentCount: currentMembers.length,
      maxAllowed: Infinity,
    };
  }

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
      reason:
        teamPlan === "premium_individual"
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
 * Internal helper to check if a user can create a team
 * EXPORTED for use in other files
 *
 * Rules:
 * - User plan must not be "free"
 * - User can own maximum 1 team (enforced for NEW creations only, grandfathers existing)
 */
export async function _canCreateTeam(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{
  allowed: boolean;
  reason?: string;
  ownedCount: number;
  canUpgrade: boolean;
}> {
  // Allow unlimited teams in dev mode
  if (isDevMode()) {
    const ownedTeams = await ctx.db
      .query("teams")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      allowed: true,
      ownedCount: ownedTeams.length,
      canUpgrade: false,
    };
  }

  // Check user's plan
  const userPlan = await _getUserPlan(ctx, userId);

  if (userPlan === "free") {
    return {
      allowed: false,
      reason: "Solo usuarios Premium pueden crear equipos. Actualiza tu plan.",
      ownedCount: 0,
      canUpgrade: true, // Upgrading to premium would allow team creation
    };
  }

  // Count owned teams (active teams where user is creator)
  const ownedTeams = await ctx.db
    .query("teams")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  const ownedCount = ownedTeams.length;

  if (ownedCount >= 1) {
    return {
      allowed: false,
      reason: "Ya tienes un equipo. Solo puedes crear un equipo por cuenta.",
      ownedCount,
      canUpgrade: false, // Upgrading won't help - no plan allows 2+ teams
    };
  }

  return {
    allowed: true,
    ownedCount,
    canUpgrade: false, // Already allowed, no upgrade needed
  };
}

/**
 * Check if a user can access library features in a given workspace context
 * EXPORTED for use in other files
 *
 * Library access rules:
 * - Personal library: Only if user has premium plan
 * - Team library: If user is in a team with premium_team plan (even if user is free)
 */
export async function _canAccessLibrary(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    teamId?: Id<"teams">;
  },
): Promise<{
  allowed: boolean;
  reason?: string;
  isTeamLibrary: boolean;
}> {
  // Check if this is a team library request
  if (args.teamId) {
    // Verify user is a member of this team
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("teamId"), args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership) {
      return {
        allowed: false,
        reason: "No eres miembro de este equipo",
        isTeamLibrary: true,
      };
    }

    // Check if team has premium plan
    const teamPlan = await _getTeamPlan(ctx, args.teamId);
    if (teamPlan === "premium_team") {
      return {
        allowed: true,
        isTeamLibrary: true,
      };
    }

    return {
      allowed: false,
      reason: "El equipo necesita plan Premium para acceder a la biblioteca",
      isTeamLibrary: true,
    };
  }

  // Personal library - check user's own plan
  const userPlan = await _getUserPlan(ctx, args.userId);
  if (userPlan === "premium_individual" || userPlan === "premium_team") {
    return {
      allowed: true,
      isTeamLibrary: false,
    };
  }

  return {
    allowed: false,
    reason: "Necesitas plan Premium para acceder a la biblioteca personal",
    isTeamLibrary: false,
  };
}

/**
 * Check if a user can access WhatsApp agent
 * EXPORTED for use in other files
 *
 * Access rules:
 * - User has premium_individual or premium_team plan → allowed
 * - User is a member of any team with premium_team plan → allowed
 * - Free users not in premium teams → denied
 */
export async function _canAccessWhatsapp(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // Allow access in dev mode
  if (isDevMode()) {
    return { allowed: true };
  }

  // 1. Check user's personal plan first
  const userPlan = await _getUserPlan(ctx, userId);
  if (userPlan === "premium_individual" || userPlan === "premium_team") {
    return { allowed: true };
  }

  // 2. User is free - check if they're a member of any team with premium_team plan
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  // Check each team's plan
  for (const membership of memberships) {
    const teamPlan = await _getTeamPlan(ctx, membership.teamId);
    if (teamPlan === "premium_team") {
      return { allowed: true };
    }
  }

  // 3. User doesn't have premium access
  return {
    allowed: false,
    reason:
      "El agente de WhatsApp solo está disponible para usuarios Premium. Actualiza tu plan para acceder a esta funcionalidad.",
  };
}

/**
 * Check if dev mode is currently enabled
 * Used by frontend to show unlimited limits in UI
 */
export const isDevModeEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (_ctx, _args): Promise<boolean> => {
    return isDevMode();
  },
});

/**
 * Get the current plan for a user by checking their Stripe subscription
 */
export const getUserPlan = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.literal("free"),
    v.literal("premium_individual"),
    v.literal("premium_team"),
  ),
  handler: async (ctx, args): Promise<PlanType> => {
    return await _getUserPlan(ctx, args.userId);
  },
});

/**
 * Check if a user can access WhatsApp agent
 */
export const canAccessWhatsapp = query({
  args: { userId: v.id("users") },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await _canAccessWhatsapp(ctx, args.userId);
  },
});

/**
 * Internal query to check if a user can access WhatsApp agent
 */
export const canAccessWhatsappInternal = internalQuery({
  args: { userId: v.id("users") },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    return await _canAccessWhatsapp(ctx, args.userId);
  },
});

/**
 * Get the plan for a team (internal use)
 *
 * SIMPLIFIED MODEL:
 * Team plan is ALWAYS the owner's plan (no separate team subscriptions)
 * - If owner has free → team is frozen (read-only)
 * - If owner has premium_individual → team has 3 member limit
 * - If owner has premium_team → team has 6 member limit + GPT-5 for all
 */
export const getTeamPlanInternal = internalQuery({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.literal("free"),
    v.literal("premium_individual"),
    v.literal("premium_team"),
  ),
  handler: async (ctx, args): Promise<PlanType> => {
    return await _getTeamPlan(ctx, args.teamId);
  },
});

/**
 * Get the plan for a team (public query for UI)
 *
 * Returns the team's plan based on the owner's subscription
 */
export const getTeamPlan = query({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.literal("free"),
    v.literal("premium_individual"),
    v.literal("premium_team"),
  ),
  handler: async (ctx, args): Promise<PlanType> => {
    return await _getTeamPlan(ctx, args.teamId);
  },
});

/**
 * Check if a user has access to a specific feature
 * Context-aware: checks based on case workspace (personal vs team)
 *
 * @param userId - The user to check access for
 * @param feature - The feature to check (e.g., "gpt5_access", "team_library", "create_case")
 * @param caseId - Optional case context to determine workspace (personal vs team)
 */
export const hasFeatureAccess = query({
  args: {
    userId: v.id("users"),
    feature: v.string(),
    caseId: v.optional(v.id("cases")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    canUpgrade: v.optional(v.boolean()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ allowed: boolean; reason?: string; canUpgrade?: boolean }> => {
    // Allow all features in dev mode
    if (isDevMode()) {
      return { allowed: true };
    }

    // Determine workspace context from case
    let teamId: Id<"teams"> | undefined = undefined;
    if (args.caseId) {
      const caseId = args.caseId; // TypeScript narrowing
      const teamAccess = await ctx.db
        .query("caseAccess")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .filter((q) => q.neq(q.field("teamId"), undefined))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (teamAccess?.teamId) {
        // Verify user is a member
        const membership = await ctx.db
          .query("teamMemberships")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("teamId"), teamAccess.teamId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();

        if (membership) {
          teamId = teamAccess.teamId;
        }
      }
    }

    const billing = await _getBillingEntity(ctx, {
      userId: args.userId,
      teamId: teamId,
    });
    const limits = PLAN_LIMITS[billing.plan];

    // Special handling for create_team feature - check ownership limits
    if (args.feature === "create_team") {
      const canCreate = await _canCreateTeam(ctx, args.userId);
      return {
        allowed: canCreate.allowed,
        reason: canCreate.reason,
        canUpgrade: canCreate.canUpgrade,
      };
    }

    // Premium users have full access to other features
    if (
      billing.plan === "premium_individual" ||
      billing.plan === "premium_team"
    ) {
      return { allowed: true };
    }

    // Free users: check feature flags
    switch (args.feature) {
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
 * Get the appropriate AI model for a user based on their personal plan only
 * Used for non-case contexts (e.g., home page assistant)
 * Internal mutation wrapper for _getModelForUserPersonal
 */
export const getModelForUserPersonal = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(v.literal("gpt-5"), v.literal("gpt-4o")),
  handler: async (ctx, args): Promise<"gpt-5" | "gpt-4o"> => {
    return await _getModelForUserPersonal(ctx, args.userId);
  },
});

/**
 * Get the appropriate AI model for a user in a specific case context
 * Used for case-specific AI interactions
 * Internal mutation wrapper for _getModelForUserInCase
 */
export const getModelForUserInCase = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
  },
  returns: v.union(v.literal("gpt-5"), v.literal("gpt-4o")),
  handler: async (ctx, args): Promise<"gpt-5" | "gpt-4o"> => {
    return await _getModelForUserInCase(ctx, args.userId, args.caseId);
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
      v.literal("storageUsedBytes"),
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
    // Skip credit decrementing in dev mode
    if (isDevMode()) {
      return null;
    }

    const amount = args.amount || 1;

    // Get billing entity
    const billing = await _getBillingEntity(ctx, {
      userId: args.userId,
      teamId: args.teamId,
    });

    const limits = PLAN_LIMITS[billing.plan];
    const usage = await _getOrCreateUsageLimits(
      ctx,
      billing.entityId,
      billing.entityType,
    );

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
 * Check if a user can access library in a given workspace context
 */
export const canAccessLibrary = query({
  args: {
    userId: v.id("users"),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    isTeamLibrary: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await _canAccessLibrary(ctx, args);
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
 * Check if a user can create a team
 * Validates plan level and ownership limits
 */
export const canCreateTeam = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    ownedCount: v.number(),
    canUpgrade: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await _canCreateTeam(ctx, args.userId);
  },
});

/**
 * Check if a user can downgrade to a specific plan
 * Validates that downgrade won't violate team member limits
 *
 * Rules:
 * - Downgrade to premium_individual: team must have ≤3 members
 * - Downgrade to free: team will be frozen (can't add members, create cases)
 */
export const canDowngradeToPlan = query({
  args: {
    userId: v.id("users"),
    newPlan: v.union(
      v.literal("free"),
      v.literal("premium_individual"),
      v.literal("premium_team"),
    ),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    teamMemberCount: v.optional(v.number()),
    willFreezeTeam: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get current plan
    const currentPlan = await _getUserPlan(ctx, args.userId);

    // Check if user owns a team
    const ownedTeam = await ctx.db
      .query("teams")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    // If no team, downgrade is always allowed
    if (!ownedTeam) {
      return {
        allowed: true,
        willFreezeTeam: false,
      };
    }

    // Count team members
    const teamMembers = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", ownedTeam._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const memberCount = teamMembers.length;

    // Check downgrade to free
    if (args.newPlan === "free") {
      // Always allow but warn about freezing
      return {
        allowed: true,
        reason:
          "Tu equipo será congelado (solo lectura) hasta que actualices tu plan.",
        teamMemberCount: memberCount,
        willFreezeTeam: true,
      };
    }

    // Check downgrade to premium_individual
    if (
      args.newPlan === "premium_individual" &&
      currentPlan === "premium_team"
    ) {
      if (memberCount > 3) {
        return {
          allowed: false,
          reason: `Tu equipo tiene ${memberCount} miembros. Premium Individual solo permite 3. Elimina ${memberCount - 3} miembros primero.`,
          teamMemberCount: memberCount,
          willFreezeTeam: false,
        };
      }

      return {
        allowed: true,
        reason: "Los miembros de tu equipo perderán acceso a GPT-5.",
        teamMemberCount: memberCount,
        willFreezeTeam: false,
      };
    }

    // Upgrade or same plan - always allowed
    return {
      allowed: true,
      willFreezeTeam: false,
    };
  },
});

/**
 * Check if a team is frozen (owner has free plan)
 * Frozen teams are read-only
 */
export const isTeamFrozen = query({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const teamPlan = await _getTeamPlan(ctx, args.teamId);
    return teamPlan === "free";
  },
});

/**
 * Get current usage limits for a user or team
 * Used for dashboard display
 */
export const getUsageLimits = query({
  args: { entityId: v.string() },
  returns: v.object({
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
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();

    // If no limits record exists, return default zero values
    // This handles existing users who don't have limits initialized yet
    // The actual record will be created when they perform an action
    if (!limits) {
      return {
        entityId: args.entityId,
        entityType: "user" as const, // Default to user, will be determined properly when record is created
        casesCount: 0,
        documentsCount: 0,
        aiMessagesThisMonth: 0,
        escritosCount: 0,
        libraryDocumentsCount: 0,
        storageUsedBytes: 0,
        lastResetDate: Date.now(),
        currentMonthStart: Date.now(),
      };
    }

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
