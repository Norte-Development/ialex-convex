import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

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
        `[Webhook] Processing AI credits purchase - Invoice: ${args.invoiceId}, User: ${args.userId}, Credits: ${args.creditsAmount}`,
      );

      // Insert purchase record
      await ctx.db.insert("aiCreditPurchases", {
        userId: args.userId,
        stripeInvoiceId: args.invoiceId,
        creditsAmount: args.creditsAmount,
        priceUSD: args.priceUSD,
        status: "completed",
        purchasedAt: Date.now(),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
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
          `[Webhook] Updated existing credits for user ${args.userId}: ${existing.remaining} -> ${existing.remaining + args.creditsAmount}`,
        );
      } else {
        // Create new credits record
        await ctx.db.insert("aiCredits", {
          userId: args.userId,
          purchased: args.creditsAmount,
          used: 0,
          remaining: args.creditsAmount,
          expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
          lastUpdated: Date.now(),
        });
        console.log(
          `[Webhook] Created new credits record for user ${args.userId}: ${args.creditsAmount} credits`,
        );
      }

      console.log(
        `[Webhook] ✅ AI credits purchase completed successfully - Invoice: ${args.invoiceId}`,
      );

      return null;
    } catch (error) {
      // Log detailed error information
      console.error(
        `[Webhook] ❌ ERROR processing AI credits purchase - Invoice: ${args.invoiceId}, User: ${args.userId}`,
        error,
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
          expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        });
      } catch (insertError) {
        console.error(
          `[Webhook] ❌ Failed to create error record for invoice ${args.invoiceId}:`,
          insertError,
        );
      }

      // Re-throw error to notify Stripe webhook system
      throw new Error(
        `Failed to process AI credits purchase for invoice ${args.invoiceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
});

/**
 * Handle subscription activation
 * Called when a subscription is created or updated to active status
 *
 * This function:
 * 1. Finds the user associated with the Stripe customer ID
 * 2. Gets subscription and plan details from Stripe tables
 * 3. Checks if thank you email was already sent
 * 4. Schedules the subscription thank you email
 * 5. Records the email send in subscriptionEmailsSent table
 *
 * Error handling:
 * - Logs detailed error information for debugging
 * - Throws error to notify Stripe webhook system of failure
 */
export const handleSubscriptionActivated = internalMutation({
  args: {
    subscriptionId: v.string(),
    customerId: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(
        `[Webhook] Processing subscription activation - Subscription: ${args.subscriptionId}, Customer: ${args.customerId}, Status: ${args.status}`,
      );

      // Find user by Stripe customer ID
      const stripeCustomer = await ctx.db
        .query("stripeCustomers")
        .filter((q) => q.eq(q.field("customerId"), args.customerId))
        .first();

      if (!stripeCustomer) {
        console.error(
          `[Webhook] ⚠️ Stripe customer not found in database: ${args.customerId}`,
        );
        return null; // Don't throw error, just skip
      }

      // Get userId from entityId (which is a string representation of user ID)
      const userId = stripeCustomer.entityId as any;

      // Check if email was already sent for this subscription
      const existingEmail = await ctx.db
        .query("subscriptionEmailsSent")
        .filter((q) => q.eq(q.field("subscriptionId"), args.subscriptionId))
        .first();

      if (existingEmail) {
        console.log(
          `[Webhook] ℹ️ Thank you email already sent for subscription ${args.subscriptionId}`,
        );
        return null;
      }

      // Get subscription details
      const stripeSubscription = await ctx.db
        .query("stripeSubscriptions")
        .filter((q) => q.eq(q.field("subscriptionId"), args.subscriptionId))
        .first();

      if (!stripeSubscription) {
        console.error(
          `[Webhook] ⚠️ Subscription not found in database: ${args.subscriptionId}`,
        );
        return null;
      }

      // Get the stripe object which contains the full subscription data
      const subscription = stripeSubscription.stripe;

      // Get the first price ID from subscription items
      const priceId = subscription.items?.data?.[0]?.price?.id;

      if (!priceId) {
        console.error(
          `[Webhook] ⚠️ No price ID found in subscription: ${args.subscriptionId}`,
        );
        return null;
      }

      // Get price details to determine plan type
      const stripePrice = await ctx.db
        .query("stripePrices")
        .filter((q) => q.eq(q.field("priceId"), priceId))
        .first();

      if (!stripePrice) {
        console.error(`[Webhook] ⚠️ Price not found in database: ${priceId}`);
        return null;
      }

      // Get product ID from price
      const productId = (stripePrice.stripe as any).productId;

      if (!productId) {
        console.error(`[Webhook] ⚠️ No product ID found in price: ${priceId}`);
        return null;
      }

      // Get product details for plan name
      const stripeProduct = await ctx.db
        .query("stripeProducts")
        .filter((q) => q.eq(q.field("productId"), productId))
        .first();

      if (!stripeProduct) {
        console.error(
          `[Webhook] ⚠️ Product not found in database: ${productId}`,
        );
        return null;
      }

      // Get user details for email
      const user = await ctx.db.get(userId);
      if (!user || user._id.toString().startsWith("tutorial")) {
        console.error(`[Webhook] ⚠️ User not found: ${userId}`);
        return null;
      }

      // Get plan name from product
      const planName = stripeProduct.stripe.name;
      let planType: "premium_individual" | "premium_team" | "ai_credits" =
        "premium_individual"; // default

      if (planName.toLowerCase().includes("team")) {
        planType = "premium_team";
      } else if (
        planName.toLowerCase().includes("individual") ||
        planName.toLowerCase().includes("personal")
      ) {
        planType = "premium_individual";
      }

      // Schedule the thank you email
      await ctx.scheduler.runAfter(
        0,
        internal.billing.trials.sendSubscriptionThankYou,
        {
          userId: userId,
          email: (user as any).email || "",
          name: (user as any).name || "Usuario",
          planName: planName,
          planType: planType as any,
        },
      );

      // Record that email was sent
      await ctx.db.insert("subscriptionEmailsSent", {
        subscriptionId: args.subscriptionId,
        userId: userId,
        sentAt: Date.now(),
      });

      console.log(
        `[Webhook] ✅ Scheduled subscription thank you email for user ${userId}, subscription ${args.subscriptionId}`,
      );

      return null;
    } catch (error) {
      console.error(
        `[Webhook] ❌ ERROR processing subscription activation - Subscription: ${args.subscriptionId}`,
        error,
      );

      // Re-throw error to notify Stripe webhook system
      throw new Error(
        `Failed to process subscription activation for ${args.subscriptionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
});
