/**
 * Stripe Pricing Configuration
 * 
 * This file contains the Stripe Price IDs for each subscription plan.
 * Update these with your actual Stripe Price IDs from your Stripe Dashboard.
 * 
 * To get your Price IDs:
 * 1. Go to https://dashboard.stripe.com/products
 * 2. Click on your product
 * 3. Copy the Price ID (starts with price_)
 * 
 * For development, you can use Stripe test mode Price IDs.
 * For production, use live mode Price IDs.
 */

export const STRIPE_PRICE_IDS = {
  /**
   * Premium Individual Plan
   * - $30/month
   * - Unlimited cases, documents, escritos
   * - GPT-5 access for owner
   * - Can create teams (up to 3 members each)
   */
  premium_individual: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL || "price_premium_individual_default",
  
  /**
   * Premium Team Plan  
   * - $200/month per team
   * - All Premium Individual features
   * - Up to 6 team members
   * - GPT-5 access for ALL team members
   * - Shared team library
   */
  premium_team: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_TEAM || "price_premium_team_default",
} as const;

console.log(STRIPE_PRICE_IDS);

/**
 * Plan display names for UI
 */
export const PLAN_NAMES = {
  free: "Gratuito",
  premium_individual: "Premium Individual",
  premium_team: "Premium Equipo",
} as const;

/**
 * Plan pricing for display
 */
export const PLAN_PRICING = {
  free: {
    price: 0,
    currency: "ARS",
    period: "siempre",
  },
  premium_individual: {
    price: 30000,
    currency: "ARS",
    period: "mes",
  },
  premium_team: {
    price: 200000,
    currency: "ARS",
    period: "mes",
  },
} as const;

