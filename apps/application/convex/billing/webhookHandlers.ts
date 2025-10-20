import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Handle AI credits purchase completion
 * Called when a one-time payment is completed via Stripe
 * 
 * This function:
 * 1. Records the purchase in aiCreditPurchases table
 * 2. Updates or creates the user's aiCredits record
 * 3. Credits expire after 90 days
 * 
 * Error handling:
 * - Logs detailed error information for debugging
 * - Creates failed purchase record for audit trail
 * - Throws error to notify Stripe webhook system of failure
 */
export const handleAICreditsPurchase = internalMutation({
  args: {
    invoiceId: v.string(),
    userId: v.id("users"),
    creditsAmount: v.number(),
    priceUSD: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(
        `[Webhook] Processing AI credits purchase - Invoice: ${args.invoiceId}, User: ${args.userId}, Credits: ${args.creditsAmount}`
      );

      // Insert purchase record
      await ctx.db.insert("aiCreditPurchases", {
        userId: args.userId,
        stripeInvoiceId: args.invoiceId,
        creditsAmount: args.creditsAmount,
        priceUSD: args.priceUSD,
        status: "completed",
        purchasedAt: Date.now(),
        expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
      });

      // Update or create aiCredits record
      const existing = await ctx.db
        .query("aiCredits")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (existing) {
        // Update existing credits
        await ctx.db.patch(existing._id, {
          purchased: existing.purchased + args.creditsAmount,
          remaining: existing.remaining + args.creditsAmount,
          lastUpdated: Date.now(),
        });
        console.log(
          `[Webhook] Updated existing credits for user ${args.userId}: ${existing.remaining} -> ${existing.remaining + args.creditsAmount}`
        );
      } else {
        // Create new credits record
        await ctx.db.insert("aiCredits", {
          userId: args.userId,
          purchased: args.creditsAmount,
          used: 0,
          remaining: args.creditsAmount,
          expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
          lastUpdated: Date.now(),
        });
        console.log(
          `[Webhook] Created new credits record for user ${args.userId}: ${args.creditsAmount} credits`
        );
      }

      console.log(
        `[Webhook] ✅ AI credits purchase completed successfully - Invoice: ${args.invoiceId}`
      );

      return null;
    } catch (error) {
      // Log detailed error information
      console.error(
        `[Webhook] ❌ ERROR processing AI credits purchase - Invoice: ${args.invoiceId}, User: ${args.userId}`,
        error
      );

      // Try to create a failed purchase record for audit trail
      try {
        await ctx.db.insert("aiCreditPurchases", {
          userId: args.userId,
          stripeInvoiceId: args.invoiceId,
          creditsAmount: args.creditsAmount,
          priceUSD: args.priceUSD,
          status: "failed",
          purchasedAt: Date.now(),
          expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
        });
      } catch (insertError) {
        console.error(
          `[Webhook] ❌ Failed to create error record for invoice ${args.invoiceId}:`,
          insertError
        );
      }

      // Re-throw error to notify Stripe webhook system
      throw new Error(
        `Failed to process AI credits purchase for invoice ${args.invoiceId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

