import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { STRIPE_PRICE_IDS } from "@/lib/billing/pricingConfig";
import { PlanType } from "./types";
import { Id } from "../../../convex/_generated/dataModel";

interface UseUpgradeOptions {
  teamId?: Id<"teams">;
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
  const { teamId, onSuccess, onError } = options;
  const [isUpgrading, setIsUpgrading] = useState(false);

  const user = useQuery(api.functions.users.getCurrentUser, {});
  
  // Note: Type assertion needed until Convex types are regenerated
  const createCheckoutSession = useAction(
    (api as any).billing.subscriptions.createCheckoutSession
  );
  const subscribeTeam = useAction(
    (api as any).billing.subscriptions.subscribeTeam
  );
  const upgradeToTeamFromFree = useAction(
    (api as any).billing.subscriptions.upgradeToTeamFromFree
  );

  /**
   * Upgrade current user to Premium Individual plan
   */
  const upgradeToIndividual = async () => {
    if (!user?._id) {
      const error = new Error("Usuario no autenticado");
      toast.error("Debes iniciar sesión para actualizar tu plan");
      onError?.(error);
      return;
    }

    setIsUpgrading(true);
    try {
      const result = await createCheckoutSession({
        entityId: user._id,
        priceId: STRIPE_PRICE_IDS.premium_individual,
      });

      if (result.url) {
        toast.success("Redirigiendo a checkout...");
        onSuccess?.();
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error("No se recibió URL de checkout");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      const err = error instanceof Error ? error : new Error("Error desconocido");
      toast.error("No se pudo crear la sesión de pago", {
        description: err.message,
      });
      onError?.(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  /**
   * Upgrade team to Premium Team plan
   * Requires a teamId to be provided
   */
  const upgradeToTeam = async (targetTeamId?: Id<"teams">) => {
    const finalTeamId = targetTeamId || teamId;
    
    if (!finalTeamId) {
      const error = new Error("ID de equipo no proporcionado");
      toast.error("Debes especificar un equipo para actualizar");
      onError?.(error);
      return;
    }

    if (!user?._id) {
      const error = new Error("Usuario no autenticado");
      toast.error("Debes iniciar sesión para actualizar tu equipo");
      onError?.(error);
      return;
    }

    setIsUpgrading(true);
    try {
      const result = await subscribeTeam({
        teamId: finalTeamId,
        priceId: STRIPE_PRICE_IDS.premium_team,
      });

      if (result.url) {
        toast.success("Redirigiendo a checkout del equipo...");
        onSuccess?.();
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error("No se recibió URL de checkout");
      }
    } catch (error) {
      console.error("Error creating team checkout session:", error);
      const err = error instanceof Error ? error : new Error("Error desconocido");
      toast.error("No se pudo crear la sesión de pago del equipo", {
        description: err.message,
      });
      onError?.(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  /**
   * Upgrade free user directly to Premium Team
   * Automatically creates a team using their firm name
   */
  const upgradeToTeamAutoCreate = async () => {
    if (!user?._id) {
      const error = new Error("Usuario no autenticado");
      toast.error("Debes iniciar sesión para actualizar");
      onError?.(error);
      return;
    }

    setIsUpgrading(true);
    try {
      const result = await upgradeToTeamFromFree({
        userId: user._id,
        teamPriceId: STRIPE_PRICE_IDS.premium_team,
      });

      if (result.url) {
        toast.success("Creando tu equipo y redirigiendo...");
        onSuccess?.();
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error("No se recibió URL de checkout");
      }
    } catch (error) {
      console.error("Error creating team upgrade:", error);
      const err = error instanceof Error ? error : new Error("Error desconocido");
      toast.error("No se pudo crear el equipo", {
        description: err.message,
      });
      onError?.(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  /**
   * Generic upgrade function based on target plan
   * Automatically chooses between individual or team upgrade
   */
  const upgradeToPlan = async (targetPlan: PlanType, targetTeamId?: Id<"teams">) => {
    if (targetPlan === "free") {
      toast.info("Ya estás en el plan gratuito");
      return;
    }

    if (targetPlan === "premium_individual") {
      await upgradeToIndividual();
    } else if (targetPlan === "premium_team") {
      await upgradeToTeam(targetTeamId);
    }
  };

  return {
    upgradeToIndividual,
    upgradeToTeam,
    upgradeToTeamAutoCreate,
    upgradeToPlan,
    isUpgrading,
  };
}

