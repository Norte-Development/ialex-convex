import { useState } from "react";
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
import { TeamUpgradeDialog } from "./TeamUpgradeDialog";
import { PlanType } from "./types";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUpgrade } from "./useUpgrade";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  currentPlan: PlanType;
  recommendedPlan?: PlanType;
  teamId?: Id<"teams">; // For team upgrades
  onUpgrade?: () => void; // Deprecated: use built-in upgrade functionality
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
 * @param onUpgrade - Callback when user clicks upgrade button
 * 
 * @example
 * ```tsx
 * <UpgradeModal
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   reason="Límite de 2 casos alcanzado"
 *   currentPlan="free"
 *   recommendedPlan="premium_individual"
 *   onUpgrade={handleStripeCheckout}
 * />
 * ```
 */
export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  currentPlan,
  recommendedPlan = "premium_individual",
  teamId,
  onUpgrade,
}: UpgradeModalProps) {
  const { upgradeToPlan, upgradeToTeamAutoCreate, isUpgrading } = useUpgrade({ teamId });
  const [showTeamUpgradeDialog, setShowTeamUpgradeDialog] = useState(false);
  
  const user = useQuery((api as any).functions.users.getCurrentUser, {});

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
                onUpgrade();
                onOpenChange(false);
                return;
              }
              
              // Handle team plan upgrade for free users
              if (plan === "premium_team" && currentPlan === "free") {
                setShowTeamUpgradeDialog(true);
                return;
              }
              
              // Check if upgrading to team plan without a team
              if (plan === "premium_team" && !teamId) {
                toast.info("Primero crea un equipo", {
                  description: "Ve a la sección de Equipos para crear uno y luego podrás actualizarlo a Premium Equipo",
                });
                onOpenChange(false);
                return;
              }
              
              upgradeToPlan(plan, teamId);
              // Don't close modal - redirect will happen
            }}
            isUpgrading={isUpgrading}
          />
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Team Upgrade Dialog (nested) */}
      <TeamUpgradeDialog
        open={showTeamUpgradeDialog}
        onOpenChange={setShowTeamUpgradeDialog}
        onUpgradeTeamAutoCreate={async () => {
          await upgradeToTeamAutoCreate();
          setShowTeamUpgradeDialog(false);
          onOpenChange(false);
        }}
        isUpgrading={isUpgrading}
        firmName={user?.firmName}
        userName={user?.name}
      />
    </Dialog>
  );
}

