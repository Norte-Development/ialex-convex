import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { STRIPE_PRICE_IDS } from "@/lib/billing/pricingConfig";
import { PlanType } from "./types";

interface UseUpgradeOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to handle plan upgrades via Stripe checkout
 *
 * Provides functions to upgrade individual users or teams to premium plans.
 * Automatically redirects to Stripe checkout and handles errors.
 *
 * @param options - Configuration options
 * @param options.teamId - Optional team ID for team upgrades
 * @param options.onSuccess - Callback when checkout session is created
 * @param options.onError - Callback when an error occurs
 *
 * @example
 * ```tsx
 * const { upgradeToIndividual, upgradeToTeam, isUpgrading } = useUpgrade({
 *   onSuccess: () => toast.success("Redirigiendo a checkout..."),
 * });
 *
 * <Button onClick={upgradeToIndividual}>
 *   Actualizar a Premium
 * </Button>
 * ```
 */
export function useUpgrade(options: UseUpgradeOptions = {}) {
  const { onSuccess, onError } = options;
  const [isUpgrading, setIsUpgrading] = useState(false);

  const user = useQuery(api.functions.users.getCurrentUser, {});

  // Note: Type assertion needed until Convex types are regenerated
  const createCheckoutSession = useAction(
    api.billing.subscriptions.createCheckoutSession,
  );

  /**
   * Upgrade current user to a specific plan
   * SIMPLIFIED: All upgrades are user-level (no separate team subscriptions)
   */
  const upgradeToPlan = async (targetPlan: PlanType) => {
    if (!user?._id) {
      const error = new Error("Usuario no autenticado");
      toast.error("Debes iniciar sesión para actualizar tu plan");
      onError?.(error);
      return;
    }

    if (targetPlan === "free") {
      toast.info("Ya estás en el plan gratuito");
      return;
    }

    setIsUpgrading(true);
    try {
      const priceId =
        targetPlan === "premium_individual"
          ? STRIPE_PRICE_IDS.premium_individual
          : STRIPE_PRICE_IDS.premium_team;

      const result = await createCheckoutSession({
        entityId: user._id,
        priceId: priceId,
      });

      if (result.url) {
        const planName =
          targetPlan === "premium_individual"
            ? "Premium Individual"
            : "Premium Team";
        toast.success(`Redirigiendo a checkout de ${planName}...`);
        onSuccess?.();
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error("No se recibió URL de checkout");
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Error desconocido");
      toast.error("No se pudo crear la sesión de pago", {
        description: err.message,
      });
      onError?.(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  /**
   * Upgrade to Premium Individual (convenience wrapper)
   */
  const upgradeToIndividual = async () => {
    await upgradeToPlan("premium_individual");
  };

  /**
   * Upgrade to Premium Team (convenience wrapper)
   * Note: User can create their team AFTER upgrading
   */
  const upgradeToTeam = async () => {
    await upgradeToPlan("premium_team");
  };

  return {
    upgradeToPlan,
    upgradeToIndividual,
    upgradeToTeam,
    isUpgrading,
  };
}
