import { v } from "convex/values";
import { action, internalQuery, internalMutation, internalAction } from "../_generated/server";
import { stripe } from "../stripe";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import Stripe from "stripe";

// Initialize Stripe SDK
const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
 * Internal query to get Stripe customer for an entity
 */
export const getStripeCustomer = internalQuery({
  args: { entityId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("stripeCustomers"),
      customerId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .filter((q) => q.eq(q.field("entityId"), args.entityId))
      .first();
    
    if (!customer) {
      return null;
    }
    
    return {
      _id: customer._id,
      customerId: customer.customerId,
    };
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
 * Internal query to get user with firm name for team creation
 */
export const getUserWithFirmName = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
      name: v.string(),
      email: v.string(),
      firmName: v.union(v.string(), v.null()),
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
      firmName: user.firmName || null,
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
    allowPromotionCodes: v.optional(v.boolean()), // Add optional parameter
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    // Get or create Stripe customer
    let customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
      entityId: args.entityId,
    });

    // If customer doesn't exist, create one
    if (!customer) {
      const user = await ctx.runQuery(internal.billing.subscriptions.getUserForSetup, {
        userId: args.entityId,
      });

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      const customerId = await ctx.runAction(internal.billing.subscriptions.setupCustomerInternal, {
        userId: args.entityId,
        email: user.email,
        clerkId: user.clerkId,
        name: user.name,
      });

      if (!customerId) {
        throw new Error("No se pudo crear el cliente de Stripe");
      }

      // Fetch the newly created customer
      customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
        entityId: args.entityId,
      });

      if (!customer) {
        throw new Error("No se encontró el cliente de Stripe después de crearlo");
      }
    }

    // Create checkout session directly with Stripe SDK
    const session = await stripeSDK.checkout.sessions.create({
      customer: customer.customerId,
      mode: "subscription",
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: args.allowPromotionCodes ?? true, // Enable coupon input
      success_url: `${baseUrl}/billing/success?plan=premium_individual&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/preferencias?section=billing`,
      metadata: {
        userId: args.entityId,
      },
    });

    return { url: session.url! };
  },
});


export const portal = action({
  args: {
    entityId: v.id("users"),
  },

  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    const response = await stripe.portal((ctx as any), {
      entityId: args.entityId,
      return: {
        url: `${baseUrl}/preferencias?section=billing`,
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
    allowPromotionCodes: v.optional(v.boolean()),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    // Get or create Stripe customer
    let customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
      entityId: args.entityId,
    });

    // If customer doesn't exist, create one
    if (!customer) {
      const user = await ctx.runQuery(internal.billing.subscriptions.getUserForSetup, {
        userId: args.entityId,
      });

      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      const customerId = await ctx.runAction(internal.billing.subscriptions.setupCustomerInternal, {
        userId: args.entityId,
        email: user.email,
        clerkId: user.clerkId,
        name: user.name,
      });

      if (!customerId) {
        throw new Error("No se pudo crear el cliente de Stripe");
      }

      // Fetch the newly created customer
      customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
        entityId: args.entityId,
      });

      if (!customer) {
        throw new Error("No se encontró el cliente de Stripe después de crearlo");
      }
    }

    // Create checkout session directly with Stripe SDK
    const session = await stripeSDK.checkout.sessions.create({
      customer: customer.customerId,
      mode: "payment",
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: args.allowPromotionCodes ?? true,
      success_url: `${baseUrl}/billing/success?plan=ai_credits&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/credits`,
      metadata: {
        userId: args.entityId,
      },
    });

    return { url: session.url! };
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
 * Upgrade a user directly to Premium Team plan
 * SIMPLIFIED: Just upgrades the user, they can create their team after
 */
export const upgradeToTeamFromFree = action({
  args: {
    userId: v.id("users"),
    teamPriceId: v.string(),
    allowPromotionCodes: v.optional(v.boolean()),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");

    // Get user details
    const user = await ctx.runQuery(internal.billing.subscriptions.getUserForSetup, {
      userId: args.userId,
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Verify the authenticated user matches
    if (user.clerkId !== identity.subject) {
      throw new Error("No autorizado");
    }

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    // Get or create Stripe customer
    let customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
      entityId: args.userId,
    });

    // If customer doesn't exist, create one
    if (!customer) {
      const customerId = await ctx.runAction(internal.billing.subscriptions.setupCustomerInternal, {
        userId: args.userId,
        email: user.email,
        clerkId: user.clerkId,
        name: user.name,
      });

      if (!customerId) {
        throw new Error("No se pudo crear el cliente de Stripe");
      }

      // Fetch the newly created customer
      customer = await ctx.runQuery(internal.billing.subscriptions.getStripeCustomer, {
        entityId: args.userId,
      });

      if (!customer) {
        throw new Error("No se encontró el cliente de Stripe después de crearlo");
      }
    }

    // Create checkout session directly with Stripe SDK
    const session = await stripeSDK.checkout.sessions.create({
      customer: customer.customerId,
      mode: "subscription",
      line_items: [
        {
          price: args.teamPriceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: args.allowPromotionCodes ?? true,
      success_url: `${baseUrl}/billing/success?plan=premium_team&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/preferencias?section=billing`,
      metadata: {
        userId: args.userId,
        type: "user_subscription",
      },
    });

    return { url: session.url! };
  },
});