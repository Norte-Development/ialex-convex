import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlanComparison } from "./PlanComparison";
import { PlanType } from "./types";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpgrade } from "./useUpgrade";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  currentPlan: PlanType;
  recommendedPlan?: PlanType;
  onUpgrade?: (plan: PlanType) => void; // Updated to receive the selected plan
}

/**
 * Modal shown when hard limit is reached
 * Displays reason for limit, plan comparison, and upgrade options
 *
 * @param open - Whether modal is open
 * @param onOpenChange - Callback when modal state changes
 * @param reason - Explanation of why limit was reached
 * @param currentPlan - User's current plan
 * @param recommendedPlan - Suggested plan to upgrade to
 * @param onUpgrade - Callback when user clicks upgrade button (receives selected plan)
 *
 * @example
 * ```tsx
 * <UpgradeModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   reason="Límite de 2 casos alcanzado"
 *   currentPlan="free"
 *   recommendedPlan="premium_individual"
 *   onUpgrade={(plan) => handleStripeCheckout(plan)}
 * />
 * ```
 */
export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  currentPlan,
  recommendedPlan = "premium_individual",
  onUpgrade,
}: UpgradeModalProps) {
  const { upgradeToPlan, isUpgrading } = useUpgrade();

  const getRecommendedPlanName = (): string => {
    const names: Record<PlanType, string> = {
      free: "Gratuito",
      premium_individual: "Premium Individual",
      premium_team: "Premium Equipo",
    };
    return names[recommendedPlan];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Límite Alcanzado</DialogTitle>
          <DialogDescription>
            Has alcanzado el límite de tu plan actual. Actualiza para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 pr-2">
          {reason && (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="size-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {reason}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              ¿Por qué actualizar a {getRecommendedPlanName()}?
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Casos, documentos y escritos ilimitados</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Mensajes de IA ilimitados con GPT-5</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Mayor capacidad de almacenamiento</span>
              </li>
              {recommendedPlan === "premium_team" && (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Hasta 6 miembros de equipo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Biblioteca compartida de equipo</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          <PlanComparison
            currentPlan={currentPlan}
            highlightPlan={recommendedPlan}
            onSelectPlan={(plan) => {
              if (onUpgrade) {
                onUpgrade(plan);
                onOpenChange(false);
                return;
              }

              upgradeToPlan(plan);
              // Don't close modal - redirect will happen
            }}
            isUpgrading={isUpgrading}
          />
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
