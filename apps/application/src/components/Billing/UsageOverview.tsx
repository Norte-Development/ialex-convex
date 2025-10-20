import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageMeter } from "./UsageMeter";
import { useBillingData } from "./useBillingData";
import { Id } from "@/../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";

interface UsageOverviewProps {
  teamId?: Id<"teams">;
  className?: string;
}

/**
 * Overview card showing all usage limits and meters
 * Displays cases, documents, escritos, library, storage, and AI messages
 * 
 * @param teamId - Optional team context for team-specific usage
 * 
 * @example
 * ```tsx
 * <UsageOverview />
 * <UsageOverview teamId={selectedTeam._id} />
 * ```
 */
export function UsageOverview({ teamId, className }: UsageOverviewProps) {
  const { isLoading, usage, limits } = useBillingData({ teamId });

  if (isLoading || !usage || !limits) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Uso del Plan</CardTitle>
          <CardDescription>Cargando información de uso...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Convert storage to GB
  const storageUsedGB = usage.storageUsedBytes / (1024 * 1024 * 1024);
  const storageLimitGB = limits.storageGB;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Uso del Plan</CardTitle>
        <CardDescription>
          Resumen de tu uso actual y límites disponibles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <UsageMeter
          used={usage.casesCount}
          limit={limits.cases}
          label="Casos"
        />
        
        <UsageMeter
          used={usage.documentsCount}
          limit={limits.documentsPerCase}
          label="Documentos por Caso"
        />
        
        <UsageMeter
          used={usage.escritosCount}
          limit={limits.escritosPerCase}
          label="Escritos por Caso"
        />
        
        <UsageMeter
          used={usage.libraryDocumentsCount}
          limit={limits.libraryDocuments}
          label="Documentos de Biblioteca"
        />
        
        <UsageMeter
          used={parseFloat(storageUsedGB.toFixed(2))}
          limit={storageLimitGB}
          label="Almacenamiento (GB)"
        />
        
        <UsageMeter
          used={usage.aiMessagesThisMonth}
          limit={limits.aiMessagesPerMonth}
          label="Mensajes IA este mes"
        />
        
        <div className="pt-4 border-t text-xs text-gray-500">
          Última actualización: {new Date(usage.lastResetDate).toLocaleDateString("es-ES")}
        </div>
      </CardContent>
    </Card>
  );
}

