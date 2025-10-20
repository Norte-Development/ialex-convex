import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LimitWarningBannerProps {
  limitType: string;
  percentage: number;
  currentCount?: number;
  limit?: number;
  onUpgrade: () => void;
  className?: string;
}

/**
 * Non-blocking warning banner shown at 80% usage threshold
 * Dismissible with localStorage persistence
 * 
 * @param limitType - Type of limit being warned about
 * @param percentage - Current usage percentage
 * @param currentCount - Current usage count
 * @param limit - Maximum limit
 * @param onUpgrade - Callback when upgrade button is clicked
 * 
 * @example
 * ```tsx
 * <LimitWarningBanner
 *   limitType="cases"
 *   percentage={85}
 *   currentCount={17}
 *   limit={20}
 *   onUpgrade={() => setShowUpgradeModal(true)}
 * />
 * ```
 */
export function LimitWarningBanner({
  limitType,
  percentage,
  currentCount,
  limit,
  onUpgrade,
  className,
}: LimitWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Load dismissed state from localStorage
  useEffect(() => {
    const dismissedKey = `billing-warning-dismissed-${limitType}`;
    const dismissed = localStorage.getItem(dismissedKey);
    if (dismissed) {
      setIsDismissed(true);
    }
  }, [limitType]);

  // Don't show if dismissed or under 80%
  if (isDismissed || percentage < 80) {
    return null;
  }

  const handleDismiss = () => {
    const dismissedKey = `billing-warning-dismissed-${limitType}`;
    localStorage.setItem(dismissedKey, "true");
    setIsDismissed(true);
  };

  const getLimitLabel = (type: string): string => {
    const labels: Record<string, string> = {
      cases: "casos",
      documentsPerCase: "documentos por caso",
      escritosPerCase: "escritos por caso",
      libraryDocuments: "documentos de biblioteca",
      storage: "almacenamiento",
    };
    return labels[type] || type;
  };

  return (
    <Alert
      className={cn(
        "relative border-yellow-400 bg-yellow-50 pr-12",
        className
      )}
    >
      <AlertTriangle className="size-4 text-yellow-600" />
      <AlertTitle className="text-yellow-900">
        Acercándose al límite de {getLimitLabel(limitType)}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-yellow-800">
          Has usado {percentage.toFixed(0)}% de tu límite
          {currentCount !== undefined && limit !== undefined && (
            <> ({currentCount} de {limit})</>
          )}
          . Considera actualizar tu plan para evitar interrupciones.
        </p>
        <Button
          size="sm"
          onClick={onUpgrade}
          className="bg-yellow-600 hover:bg-yellow-700"
        >
          Ver Planes
        </Button>
      </AlertDescription>
      
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-yellow-600 hover:text-yellow-800 transition-colors"
        aria-label="Descartar advertencia"
      >
        <X className="size-4" />
      </button>
    </Alert>
  );
}

