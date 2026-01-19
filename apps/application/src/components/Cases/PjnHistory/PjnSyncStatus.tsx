import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CaseHistorySyncProgress } from "../CaseHistorySyncProgress";

interface PjnSyncStatusProps {
  caseId: Id<"cases">;
  fre?: string;
  lastSyncAt?: number;
}

export function PjnSyncStatus({ caseId, fre, lastSyncAt }: PjnSyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const retrySync = useMutation(api.functions.pjnCaseHistory.retryCaseHistorySync);
  
  const syncJob = useQuery(
    api.functions.pjnCaseHistory.getCaseHistorySyncStatus,
    { caseId }
  );

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await retrySync({ caseId });
      if (result.success) {
        toast.success("Sincronización iniciada en segundo plano");
      } else {
        toast.error(`Error: ${"error" in result ? result.error : "Error desconocido"}`);
      }
    } catch (error) {
      toast.error(`Error al sincronizar: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const hasActiveSync = !!(syncJob && (syncJob.status === "queued" || syncJob.status === "running"));
  const isFailed = !!(syncJob && (syncJob.status === "failed" || syncJob.status === "auth_required"));
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Estado de Sincronización PJN</h3>
            {hasActiveSync ? (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 animate-pulse">
                Sincronizando
              </Badge>
            ) : isFailed ? (
              <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-100">
                Error
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Al día
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastSyncAt 
                ? `Última sincronización: ${formatDate(lastSyncAt)}`
                : "Nunca sincronizado"}
            </p>
            {fre && (
              <p className="text-xs font-mono text-gray-400">{fre}</p>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !fre || hasActiveSync}
          className="h-9 gap-2 shadow-sm hover:bg-gray-50"
        >
          {isSyncing || hasActiveSync ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isSyncing || hasActiveSync ? "Sincronizando" : "Sincronizar"}
        </Button>
      </div>

      {(hasActiveSync || isFailed) && syncJob && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <CaseHistorySyncProgress
            status={syncJob.status}
            phase={syncJob.phase}
            progress={syncJob.progressPercent}
            errorMessage={syncJob.errorMessage}
            movimientosProcessed={syncJob.movimientosProcessed}
            documentsProcessed={syncJob.documentsProcessed}
            participantsProcessed={syncJob.participantsProcessed}
            appealsProcessed={syncJob.appealsProcessed}
            relatedCasesProcessed={syncJob.relatedCasesProcessed}
            onRetry={handleSync}
            retrying={isSyncing}
          />
        </div>
      )}
    </div>
  );
}
