import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PlanType, UsageLimits, PlanLimits } from "./types";
import { PLAN_LIMITS } from "@/lib/billing/planLimits";

interface UseBillingDataOptions {
  teamId?: Id<"teams">;
}

interface BillingData {
  isLoading: boolean;
  userId?: Id<"users">;
  plan?: PlanType;
  usage?: UsageLimits;
  limits?: PlanLimits;
  entityId?: string;
  entityType?: "user" | "team";
}

/**
 * Centralized hook for fetching all billing-related data
 * 
 * @param context - Optional context with teamId to get team-specific billing data
 * @returns Consolidated billing state with user, plan, usage, and limits
 * 
 * @example
 * ```tsx
 * const { plan, usage, limits, isLoading } = useBillingData({ teamId });
 * 
 * if (isLoading) return <Skeleton />;
 * 
 * return (
 *   <div>
 *     <h2>Plan: {plan}</h2>
 *     <UsageMeter 
 *       used={usage.casesCount} 
 *       limit={limits.cases} 
 *       label="Casos" 
 *     />
 *   </div>
 * );
 * ```
 */
export const useBillingData = (context?: UseBillingDataOptions): BillingData => {
  // Get current user
  const user = useQuery(api.functions.users.getCurrentUser, {});
  
  // Determine entity ID for billing (team or user)
  const entityId = context?.teamId || user?._id;
  
  // Get user's plan
  const plan = useQuery(
    api.billing.features.getUserPlan,
    user?._id ? { userId: user._id } : "skip"
  );
  
  // Get usage limits for the entity
  const usage = useQuery(
    api.billing.features.getUsageLimits,
    entityId ? { entityId: entityId as string } : "skip"
  );

  // Determine loading state
  const isLoading = !user || plan === undefined || usage === undefined;

  // Get plan limits from static config
  const limits = plan ? PLAN_LIMITS[plan] : undefined;

  // Determine entity type
  const entityType: "user" | "team" = context?.teamId ? "team" : "user";

  return {
    isLoading,
    userId: user?._id,
    plan,
    usage: usage || undefined,
    limits,
    entityId: entityId as string,
    entityType,
  };
};

