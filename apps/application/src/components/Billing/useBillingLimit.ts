import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { BillingLimitResult, LimitType } from "./types";
import { PLAN_LIMITS } from "@/lib/billing/planLimits";

interface UseBillingLimitOptions {
  teamId?: Id<"teams">;
  currentCount?: number;
  additionalBytes?: number;
}

/**
 * Hook for checking billing limits with warning threshold
 * 
 * @param limitType - The type of limit to check
 * @param context - Optional context with teamId, currentCount, or additionalBytes
 * @returns BillingLimitResult with allowed status, warning flag, and percentage
 * 
 * @example
 * ```tsx
 * const { allowed, isWarning, percentage, reason } = useBillingLimit("cases", { teamId });
 * if (!allowed) {
 *   // Show upgrade modal
 * } else if (isWarning) {
 *   // Show warning banner at 80%
 * }
 * ```
 */
export const useBillingLimit = (
  limitType: LimitType,
  context?: UseBillingLimitOptions
): BillingLimitResult => {
  // Get current user (required for billing entity determination)
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  
  // Check if dev mode is enabled
  const isDevMode = useQuery(api.billing.features.isDevModeEnabled, {});
  
  // If dev mode is enabled, return unlimited access
  if (isDevMode) {
    return {
      allowed: true,
      isWarning: false,
      percentage: 0,
      currentCount: 0,
      limit: Infinity,
    };
  }
  
  // Get usage limits for the billing entity (user or team)
  const entityId = context?.teamId || currentUser?._id;
  const usage = useQuery(
    api.billing.features.getUsageLimits,
    entityId ? { entityId: entityId as string } : "skip"
  );

  // Get plan type to determine limits
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  // Handle loading states
  if (!currentUser || !entityId || !userPlan || !usage) {
    return {
      allowed: true,
      isWarning: false,
      percentage: 0,
    };
  }

  const planLimits = PLAN_LIMITS[userPlan];
  let currentCount = 0;
  let limit = 0;

  // Determine current count and limit based on limit type
  switch (limitType) {
    case "cases":
      currentCount = usage.casesCount;
      limit = planLimits.cases;
      break;
    
    case "documentsPerCase":
      currentCount = context?.currentCount ?? usage.documentsCount;
      limit = planLimits.documentsPerCase;
      break;
    
    case "escritosPerCase":
      currentCount = context?.currentCount ?? usage.escritosCount;
      limit = planLimits.escritosPerCase;
      break;
    
    case "libraryDocuments":
      currentCount = usage.libraryDocumentsCount;
      limit = planLimits.libraryDocuments;
      break;
    
    case "storage":
      const storageLimitBytes = planLimits.storageGB * 1024 * 1024 * 1024;
      currentCount = usage.storageUsedBytes + (context?.additionalBytes || 0);
      limit = storageLimitBytes;
      break;
  }

  // Handle unlimited limits
  if (limit === Infinity) {
    return {
      allowed: true,
      isWarning: false,
      percentage: 0,
      currentCount,
      limit,
    };
  }

  // Calculate percentage and determine status
  const percentage = Math.min((currentCount / limit) * 100, 100);
  const allowed = currentCount < limit;
  const isWarning = percentage >= 80 && allowed;

  // Generate reason message if limit exceeded
  let reason: string | undefined;
  if (!allowed) {
    switch (limitType) {
      case "cases":
        reason = `Límite de ${limit} casos alcanzado. Actualiza a Premium para casos ilimitados.`;
        break;
      case "documentsPerCase":
        reason = `Límite de ${limit} documentos por caso alcanzado.`;
        break;
      case "escritosPerCase":
        reason = `Límite de ${limit} escritos por caso alcanzado.`;
        break;
      case "libraryDocuments":
        reason = `Límite de ${limit} documentos de biblioteca alcanzado.`;
        break;
      case "storage":
        const availableGB = (limit - usage.storageUsedBytes) / (1024 * 1024 * 1024);
        reason = `Espacio insuficiente. Disponible: ${availableGB.toFixed(2)}GB.`;
        break;
    }
  }

  return {
    allowed,
    reason,
    isWarning,
    percentage,
    currentCount,
    limit,
  };
};

