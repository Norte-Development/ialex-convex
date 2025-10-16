import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * PUBLIC migration action to backfill Stripe customers for all existing users
 * 
 * This is a one-time migration that should be run by an admin to ensure all
 * existing users have Stripe customers set up.
 * 
 * To run this migration:
 * 1. Deploy your Convex functions
 * 2. Run from the Convex dashboard or via CLI:
 *    `npx convex run billing/migrations:runBackfill`
 * 
 * This function is safe to run multiple times - it only creates customers
 * for users who don't already have them.
 */
export const runBackfill = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    totalUsers: v.number(),
    usersAlreadySetup: v.number(),
    usersSetupNow: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx): Promise<{
    success: boolean;
    totalUsers: number;
    usersAlreadySetup: number;
    usersSetupNow: number;
    errors: number;
  }> => {
    // Verify admin access (optional - add your own auth logic here)

    console.log("Starting Stripe customer backfill migration...");
    
    const result = await ctx.runAction(internal.billing.subscriptions.backfillStripeCustomers, {});
    
    console.log("Migration completed:", result);
    
    return {
      success: true,
      ...result,
    };
  },
});

