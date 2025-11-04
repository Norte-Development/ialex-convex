import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, X } from "lucide-react";
import { PlanType, PlanSelection } from "./types";
import { cn } from "@/lib/utils";
import { PLAN_PRICING } from "@/lib/billing/pricingConfig";
import { useState } from "react";

interface PlanComparisonProps {
  currentPlan?: PlanType;
  highlightPlan?: PlanType;
  className?: string;
  onSelectPlan?: (selection: PlanSelection) => void;
  isUpgrading?: boolean;
}

interface PlanFeature {
  name: string;
  free: string | boolean;
  premiumIndividual: string | boolean;
  premiumTeam: string | boolean;
}

const FEATURES: Array<PlanFeature> = [
  {
    name: "Casos",
    free: "2",
    premiumIndividual: "Ilimitados",
    premiumTeam: "Ilimitados",
  },
  {
    name: "Documentos por caso",
    free: "10",
    premiumIndividual: "Ilimitados",
    premiumTeam: "Ilimitados",
  },
  {
    name: "Escritos por caso",
    free: "3",
    premiumIndividual: "Ilimitados",
    premiumTeam: "Ilimitados",
  },
  {
    name: "Documentos de biblioteca",
    free: "5",
    premiumIndividual: "100",
    premiumTeam: "200",
  },
  {
    name: "Almacenamiento",
    free: "0.5 GB",
    premiumIndividual: "50 GB",
    premiumTeam: "200 GB",
  },
  {
    name: "Mensajes IA/mes",
    free: "50",
    premiumIndividual: "Ilimitados",
    premiumTeam: "Ilimitados",
  },
  {
    name: "Crear equipos",
    free: false,
    premiumIndividual: true,
    premiumTeam: true,
  },
  {
    name: "Miembros por equipo",
    free: "0",
    premiumIndividual: "3",
    premiumTeam: "6",
  },
  {
    name: "Acceso a GPT-5",
    free: false,
    premiumIndividual: true,
    premiumTeam: true,
  },
  {
    name: "Biblioteca de equipo",
    free: false,
    premiumIndividual: true,
    premiumTeam: true,
  },
];

const PLAN_HEADERS = {
  free: "Gratuito",
  premium_individual: "Premium Individual",
  premium_team: "Premium Equipo",
};

const ANNUAL_PRICING = {
  premium_individual: 300000,
  premium_team: 980000,
};

/**
 * Comparison table showing features across all billing plans
 * Highlights current plan and recommended upgrade
 *
 * @param currentPlan - User's current plan (to highlight)
 * @param highlightPlan - Plan to highlight as recommended
 *
 * @example
 * ```tsx
 * <PlanComparison currentPlan="free" highlightPlan="premium_individual" />
 * ```
 */
export function PlanComparison({
  currentPlan,
  highlightPlan,
  className,
  onSelectPlan,
  isUpgrading = false,
}: PlanComparisonProps) {
  const [isAnnual, setIsAnnual] = useState(false);

  const formatPrice = (plan: PlanType) => {
    const pricing = PLAN_PRICING[plan];
    if (pricing.price === 0) return "Gratis";
    
    if (isAnnual && (plan === "premium_individual" || plan === "premium_team")) {
      const annualPrice = ANNUAL_PRICING[plan];
      return `$${annualPrice.toLocaleString()} ARS/año`;
    }
    
    return `$${pricing.price.toLocaleString()} ARS/${pricing.period}`;
  };
  const renderCell = (value: string | boolean): React.ReactNode => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="size-5 text-green-600" />
      ) : (
        <X className="size-5 text-gray-400" />
      );
    }
    return <span>{value}</span>;
  };

  const getPlanColumnClass = (plan: string): string => {
    const planKey = plan as "free" | "premium_individual" | "premium_team";

    if (currentPlan === planKey) {
      return "bg-blue-50 border-l-2 border-r-2 border-blue-300";
    }

    if (highlightPlan === planKey) {
      return "bg-purple-50 border-l-2 border-r-2 border-purple-300";
    }

    return "";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Comparación de Planes</CardTitle>
        <CardDescription>
          Compara las características y límites de cada plan
        </CardDescription>
        <div className="flex items-center justify-center gap-3 pt-4">
          <span className={cn("text-sm font-medium", !isAnnual && "text-primary")}>
            Mensual
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            aria-label="Alternar entre precios mensuales y anuales"
          />
          <span className={cn("text-sm font-medium", isAnnual && "text-primary")}>
            Anual
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Característica</TableHead>
              <TableHead
                className={cn("text-center", getPlanColumnClass("free"))}
              >
                {PLAN_HEADERS.free}
                {currentPlan === "free" && (
                  <span className="ml-2 text-xs text-blue-600">(Actual)</span>
                )}
              </TableHead>
              <TableHead
                className={cn(
                  "text-center",
                  getPlanColumnClass("premium_individual"),
                )}
              >
                {PLAN_HEADERS.premium_individual}
                {currentPlan === "premium_individual" && (
                  <span className="ml-2 text-xs text-blue-600">(Actual)</span>
                )}
                {highlightPlan === "premium_individual" &&
                  currentPlan !== "premium_individual" && (
                    <span className="ml-2 text-xs text-purple-600">
                      (Recomendado)
                    </span>
                  )}
              </TableHead>
              <TableHead
                className={cn(
                  "text-center",
                  getPlanColumnClass("premium_team"),
                )}
              >
                {PLAN_HEADERS.premium_team}
                {currentPlan === "premium_team" && (
                  <span className="ml-2 text-xs text-blue-600">(Actual)</span>
                )}
                {highlightPlan === "premium_team" &&
                  currentPlan !== "premium_team" && (
                    <span className="ml-2 text-xs text-purple-600">
                      (Recomendado)
                    </span>
                  )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FEATURES.map((feature, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{feature.name}</TableCell>
                <TableCell
                  className={cn("text-center", getPlanColumnClass("free"))}
                >
                  {renderCell(feature.free)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center",
                    getPlanColumnClass("premium_individual"),
                  )}
                >
                  {renderCell(feature.premiumIndividual)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center",
                    getPlanColumnClass("premium_team"),
                  )}
                >
                  {renderCell(feature.premiumTeam)}
                </TableCell>
              </TableRow>
            ))}

            {/* Pricing Row */}
            <TableRow className="border-t-2">
              <TableCell className="font-bold">Precio</TableCell>
              <TableCell
                className={cn(
                  "text-center font-semibold text-lg",
                  getPlanColumnClass("free"),
                )}
              >
                {formatPrice("free")}
              </TableCell>
              <TableCell
                className={cn(
                  "text-center font-semibold text-lg",
                  getPlanColumnClass("premium_individual"),
                )}
              >
                {formatPrice("premium_individual")}
              </TableCell>
              <TableCell
                className={cn(
                  "text-center font-semibold text-lg",
                  getPlanColumnClass("premium_team"),
                )}
              >
                {formatPrice("premium_team")}
              </TableCell>
            </TableRow>

            {/* Action Buttons Row */}
            {onSelectPlan && (
              <TableRow>
                <TableCell className="font-bold">Acción</TableCell>
                <TableCell
                  className={cn("text-center", getPlanColumnClass("free"))}
                >
                  {currentPlan === "free" ? (
                    <span className="text-sm text-blue-600">Plan actual</span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center",
                    getPlanColumnClass("premium_individual"),
                  )}
                >
                  {currentPlan === "premium_individual" ? (
                    <span className="text-sm text-blue-600">Plan actual</span>
                  ) : (
                    <Button
                      onClick={() => {
                        if (onSelectPlan) {
                          onSelectPlan({
                            plan: "premium_individual",
                            period: isAnnual ? "annual" : "monthly",
                          });
                        }
                      }}
                      disabled={isUpgrading}
                      size="sm"
                      className={
                        highlightPlan === "premium_individual"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : ""
                      }
                    >
                      {isUpgrading ? "..." : "Actualizar"}
                    </Button>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-center",
                    getPlanColumnClass("premium_team"),
                  )}
                >
                  {currentPlan === "premium_team" ? (
                    <span className="text-sm text-blue-600">Plan actual</span>
                  ) : (
                    <Button
                      onClick={() => {
                        if (onSelectPlan) {
                          onSelectPlan({
                            plan: "premium_team",
                            period: isAnnual ? "annual" : "monthly",
                          });
                        }
                      }}
                      disabled={isUpgrading}
                      size="sm"
                      className={
                        highlightPlan === "premium_team"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : ""
                      }
                    >
                      {isUpgrading ? "..." : "Actualizar"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
