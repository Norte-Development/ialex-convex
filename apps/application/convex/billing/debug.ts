import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Debug query to check if a user has a Stripe customer set up
 * Run this in Convex dashboard to verify customer exists
 */
export const checkUserStripeSetup = query({
  args: { userId: v.id("users") },
  returns: v.object({
    hasCustomer: v.boolean(),
    customerId: v.union(v.string(), v.null()),
    hasActiveSubscription: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check if customer exists
    const customer = await ctx.db
      .query("stripeCustomers")
      .filter((q) => q.eq(q.field("entityId"), args.userId))
      .first();

    // Check for active subscriptions
    const activeSubscription = await ctx.db
      .query("stripeSubscriptions")
      .filter((q) => 
        q.and(
          q.eq(q.field("entityId"), args.userId),
          q.eq(q.field("stripe.status"), "active")
        )
      )
      .first();

    return {
      hasCustomer: customer !== null,
      customerId: customer?.customerId || null,
      hasActiveSubscription: activeSubscription !== null,
    };
  },
});

