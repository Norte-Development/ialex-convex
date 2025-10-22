import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FeatureName } from "./types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface FeatureLockProps {
  feature: FeatureName;
  children: ReactNode;
  fallback?: ReactNode;
  teamId?: Id<"teams">;
  onUpgrade?: () => void;
}

/**
 * Wrapper component to conditionally render features based on plan access
 * Shows fallback or upgrade prompt when feature is locked
 * 
 * @param feature - The feature to check access for
 * @param children - Content to show when feature is accessible
 * @param fallback - Custom fallback content (optional)
 * @param teamId - Team context for checking team-level features
 * @param onUpgrade - Callback when upgrade is requested
 * 
 * @example
 * ```tsx
 * <FeatureLock feature="create_team" onUpgrade={() => setShowUpgradeModal(true)}>
 *   <CreateTeamButton />
 * </FeatureLock>
 * ```
 */
export function FeatureLock({
  feature,
  children,
  fallback,
  onUpgrade,
}: FeatureLockProps) {
  // Get current user
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  
  // Check feature access
  const featureAccess = useQuery(
    api.billing.features.hasFeatureAccess,
    currentUser?._id
      ? {
          userId: currentUser._id,
          feature,
        }
      : "skip"
  );

  // Loading state
  if (!currentUser || featureAccess === undefined) {
    return null;
  }

  // Feature is accessible
  if (featureAccess.allowed) {
    return <>{children}</>;
  }

  // Feature is locked - show custom fallback or default upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Alert className="border-yellow-300 bg-yellow-50">
      <Lock className="size-4 text-yellow-600" />
      <AlertTitle className="text-yellow-900">
        Función Premium
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-yellow-800">
          {featureAccess.reason || "Esta función requiere un plan Premium."}
        </p>
        {onUpgrade && featureAccess.canUpgrade !== false && (
          <Button
            size="sm"
            onClick={onUpgrade}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Actualizar Plan
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

