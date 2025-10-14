import { v } from "convex/values";
import { action, internalQuery, internalAction } from "../_generated/server";
import { stripe } from "../stripe";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";


export const setupCustomer = action({
  args: { 
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    // Verify authentication - only authenticated users can set up billing
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("No autenticado");
    }

    // Get user from database to retrieve email and verify user exists
    const user = await ctx.runQuery(internal.billing.subscriptions.getUserForSetup, {
      userId: args.userId,
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verify the authenticated user matches the userId (users can only set up their own billing)
    if (user.clerkId !== identity.subject) {
      throw new Error("No autorizado para configurar facturación de otro usuario");
    }

    const response = await ctx.runAction(internal.stripe.setup, {
      entityId: args.userId,
      email: user.email,
      metadata: {
        clerkId: user.clerkId,
        userName: user.name,
      }
    });

    return response.customerId!;
  },
});

/**
 * Internal query to get user data for billing setup
 * This is separated to allow the action to query the database
 */
export const getUserForSetup = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    return {
      _id: user._id,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
    };
  },
});

/**
 * Check if a user already has a Stripe customer set up
 * Returns true if customer exists, false otherwise
 */
export const hasStripeCustomer = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .filter((q) => q.eq(q.field("entityId"), args.userId))
      .first();
    
    return customer !== null;
  },
});

/**
 * Internal action to set up Stripe customer during user creation
 * This is called automatically when a new user is created via Clerk sync
 * This function is idempotent - it will only create a customer if one doesn't exist
 */
export const setupCustomerInternal = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    clerkId: v.string(),
    name: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    // Check if user already has a Stripe customer
    const hasCustomer = await ctx.runQuery(internal.billing.subscriptions.hasStripeCustomer, {
      userId: args.userId,
    });

    if (hasCustomer) {
      console.log(`User ${args.userId} already has a Stripe customer, skipping setup`);
      return null;
    }

    // Create new Stripe customer
    const response: { customerId: string } = await ctx.runAction(internal.stripe.setup, {
      entityId: args.userId,
      email: args.email,
      metadata: {
        clerkId: args.clerkId,
        userName: args.name,
      }
    });

    console.log(`Created Stripe customer ${response.customerId} for user ${args.userId}`);
    return response.customerId;
  },
});


/**
 * Ensure the current user has Stripe billing set up
 * This is idempotent and safe to call multiple times
 * Call this when a user logs in to ensure old users get set up
 */
export const ensureUserBillingSetup = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    wasAlreadySetup: v.boolean(),
    customerId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx): Promise<{ success: boolean; wasAlreadySetup: boolean; customerId: string | null }> => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("No autenticado");
    }

    // Get user from database
    const user: { _id: Id<"users">; clerkId: string; name: string; email: string } | null = await ctx.runQuery(internal.billing.subscriptions.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Check if already set up
    const hasCustomer = await ctx.runQuery(internal.billing.subscriptions.hasStripeCustomer, {
      userId: user._id,
    });

    if (hasCustomer) {
      return {
        success: true,
        wasAlreadySetup: true,
        customerId: null,
      };
    }

    // Set up billing for this user
    const customerId: string | null = await ctx.runAction(internal.billing.subscriptions.setupCustomerInternal, {
      userId: user._id,
      email: user.email,
      clerkId: user.clerkId,
      name: user.name,
    });

    return {
      success: true,
      wasAlreadySetup: false,
      customerId: customerId,
    };
  },
});

/**
 * Internal query to get user by Clerk ID
 */
export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    
    if (!user) {
      return null;
    }
    
    return {
      _id: user._id,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
    };
  },
});

/**
 * Migration function to backfill Stripe customers for all existing users
 * This should only be run once by an admin
 */
export const backfillStripeCustomers = internalAction({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    usersAlreadySetup: v.number(),
    usersSetupNow: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx): Promise<{ totalUsers: number; usersAlreadySetup: number; usersSetupNow: number; errors: number }> => {
    const allUsers: Array<{ _id: Id<"users">; clerkId: string; name: string; email: string }> = await ctx.runQuery(internal.billing.subscriptions.getAllUsers, {});
    
    let alreadySetup = 0;
    let setupNow = 0;
    let errors = 0;

    for (const user of allUsers) {
      try {
        const hasCustomer = await ctx.runQuery(internal.billing.subscriptions.hasStripeCustomer, {
          userId: user._id,
        });

        if (hasCustomer) {
          alreadySetup++;
          console.log(`User ${user._id} already has Stripe customer`);
          continue;
        }

        // Set up Stripe for this user
        const customerId = await ctx.runAction(internal.billing.subscriptions.setupCustomerInternal, {
          userId: user._id,
          email: user.email,
          clerkId: user.clerkId,
          name: user.name,
        });

        if (customerId) {
          setupNow++;
          console.log(`Set up Stripe customer ${customerId} for user ${user._id}`);
        }
      } catch (error) {
        errors++;
        console.error(`Error setting up Stripe for user ${user._id}:`, error);
      }
    }

    return {
      totalUsers: allUsers.length,
      usersAlreadySetup: alreadySetup,
      usersSetupNow: setupNow,
      errors: errors,
    };
  },
});

/**
 * Internal query to get all users for migration
 */
export const getAllUsers = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    return users.map((user) => ({
      _id: user._id,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
    }));
  },
});

export const createCheckoutSession = action({
  args: {
    entityId: v.id("users"),
    priceId: v.string(),
  },

  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const response = await stripe.subscribe((ctx as any), {
        entityId: args.entityId,
        priceId: args.priceId,
        success: {
            url: `http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        },
        cancel: {
            url: `http://localhost:5173/pricing`,
        },
        metadata: {
            userId: args.entityId,
        },
    })

    return { url: response.url! };
  },

  returns: v.object({
    url: v.string(),
  }),
});


export const portal = action({
  args: {
    entityId: v.id("users"),
  },

  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const response = await stripe.portal((ctx as any), {
      entityId: args.entityId,
      return: {
        url: `http://localhost:5173/settings/billing`,
      },
    });

    return { url: response.url! };
  },

  returns: v.object({
    url: v.string(),
  }),
});


export const purchaseAICredits = action({
  args: {
    entityId: v.id("users"),
    priceId: v.string(),
  },

  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const response = await stripe.pay((ctx as any), {
        entityId: args.entityId,
        referenceId: args.entityId, // Add this required field
        line_items: [
          {
            price: args.priceId,
            quantity: 1,
          },
        ],
        success: {
          url: `http://localhost:5173/billing/credits/success`,
        },
        cancel: {
          url: `http://localhost:5173/billing/credits`,
        },
        metadata: {
          userId: args.entityId,
        },
      });

    return { url: response.url! };
  }
});

/**
 * Create checkout session for team subscription
 */
export const subscribeTeam = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    // Verify user is team creator
    const team = await ctx.runQuery(internal.billing.subscriptions.getTeamForBilling, {
      teamId: args.teamId,
    });

    if (!team) {
      throw new Error("Equipo no encontrado");
    }

    const currentUser = await ctx.runQuery(internal.billing.subscriptions.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new Error("Usuario no encontrado");
    }

    if (team.createdBy !== currentUser._id) {
      throw new Error("Solo el creador del equipo puede suscribirlo");
    }

    const response = await stripe.subscribe((ctx as any), {
      entityId: args.teamId,
      priceId: args.priceId,
      success: {
        url: `http://localhost:5173/teams/${args.teamId}/billing/success`,
      },
      cancel: {
        url: `http://localhost:5173/teams/${args.teamId}/settings`,
      },
      metadata: {
        teamId: args.teamId,
        type: "team_subscription",
      },
    });

    return { url: response.url! };
  },
});

/**
 * Internal query to get team data for billing
 */
export const getTeamForBilling = internalQuery({
  args: { teamId: v.id("teams") },
  returns: v.union(
    v.object({
      _id: v.id("teams"),
      createdBy: v.id("users"),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }
    return {
      _id: team._id,
      createdBy: team.createdBy,
      name: team.name,
    };
  },
});

/**
 * Check if a team already has a Stripe customer set up
 */
export const hasTeamStripeCustomer = internalQuery({
  args: { teamId: v.id("teams") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .filter((q) => q.eq(q.field("entityId"), args.teamId))
      .first();
    
    return customer !== null;
  },
});

/**
 * Internal action to set up Stripe customer for a team
 * Called automatically when a team is created
 */
export const setupTeamCustomer = internalAction({
  args: {
    teamId: v.id("teams"),
    teamName: v.string(),
    creatorEmail: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    // Check if team already has a Stripe customer
    const hasCustomer = await ctx.runQuery(internal.billing.subscriptions.hasTeamStripeCustomer, {
      teamId: args.teamId,
    });

    if (hasCustomer) {
      console.log(`Team ${args.teamId} already has a Stripe customer, skipping setup`);
      return null;
    }

    // Create new Stripe customer for the team
    const response: { customerId: string } = await ctx.runAction(internal.stripe.setup, {
      entityId: args.teamId,
      email: args.creatorEmail,
      metadata: {
        teamName: args.teamName,
        type: "team",
      }
    });

    console.log(`Created Stripe customer ${response.customerId} for team ${args.teamId}`);
    return response.customerId;
  },
});