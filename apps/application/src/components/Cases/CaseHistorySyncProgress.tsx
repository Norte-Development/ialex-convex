import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type SyncStatus = "queued" | "running" | "completed" | "failed" | "auth_required";
type SyncPhase = "connecting" | "fetching_history" | "ingesting_movements" | "ingesting_documents" | "finalizing";

interface CaseHistorySyncProgressProps {
  status: SyncStatus;
  phase?: SyncPhase;
  progress?: number;
  errorMessage?: string;
  movimientosProcessed?: number;
  documentsProcessed?: number;
  participantsProcessed?: number;
  appealsProcessed?: number;
  relatedCasesProcessed?: number;
  onRetry?: () => void;
  retrying?: boolean;
}

export function CaseHistorySyncProgress({
  status,
  phase,
  progress,
  errorMessage,
  movimientosProcessed,
  documentsProcessed,
  participantsProcessed,
  appealsProcessed,
  relatedCasesProcessed,
  onRetry,
  retrying,
}: CaseHistorySyncProgressProps) {
  const getPhaseLabel = (phase?: SyncPhase): string => {
    switch (phase) {
      case "connecting":
        return "Conectando con PJN";
      case "fetching_history":
        return "Obteniendo historial de expediente";
      case "ingesting_movements":
        return "Procesando movimientos";
      case "ingesting_documents":
        return "Descargando documentos";
      case "finalizing":
        return "Finalizando sincronización";
      default:
        return "Sincronizando";
    }
  };

  const getPhaseDescription = (phase?: SyncPhase): string => {
    switch (phase) {
      case "connecting":
        return "Estableciendo conexión segura con el portal PJN";
      case "fetching_history":
        return "Consultando el expediente y sus actuaciones";
      case "ingesting_movements":
        return "Importando movimientos del expediente";
      case "ingesting_documents":
        return "Obteniendo documentos digitalizados";
      case "finalizing":
        return "Completando la sincronización";
      default:
        return "Sincronizando información del expediente";
    }
  };

  // Completed state
  if (status === "completed") {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900">
          <div className="flex items-center justify-between">
            <span className="font-medium">Sincronización completada</span>
          </div>
          {(movimientosProcessed !== undefined || documentsProcessed !== undefined) && (
            <div className="mt-2 text-sm space-y-1">
              {movimientosProcessed !== undefined && movimientosProcessed > 0 && (
                <div>✓ {movimientosProcessed} movimientos sincronizados</div>
              )}
              {documentsProcessed !== undefined && documentsProcessed > 0 && (
                <div>✓ {documentsProcessed} documentos descargados</div>
              )}
              {participantsProcessed !== undefined && participantsProcessed > 0 && (
                <div>✓ {participantsProcessed} intervinientes registrados</div>
              )}
              {appealsProcessed !== undefined && appealsProcessed > 0 && (
                <div>✓ {appealsProcessed} recursos registrados</div>
              )}
              {relatedCasesProcessed !== undefined && relatedCasesProcessed > 0 && (
                <div>✓ {relatedCasesProcessed} expedientes vinculados</div>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Failed state
  if (status === "failed") {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="font-medium text-red-900">Error en la sincronización</span>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={retrying}
                className="ml-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Reintentando...
                  </>
                ) : (
                  "Reintentar"
                )}
              </Button>
            )}
          </div>
          {errorMessage && (
            <p className="text-sm text-red-700 mt-2">{errorMessage}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Auth required state
  if (status === "auth_required") {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="font-medium text-amber-900">Requiere autenticación</span>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={retrying}
                className="ml-2"
              >
                {retrying ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  "Reconectar"
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-amber-700 mt-2">
            {errorMessage || "Tu sesión de PJN ha expirado. Por favor, vuelve a conectar tu cuenta."}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Queued or Running state with progress
  return (
    <Alert className="bg-blue-50 border-blue-200">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-blue-900">{getPhaseLabel(phase)}</span>
            {progress !== undefined && (
              <span className="text-blue-700">{Math.round(progress)}%</span>
            )}
          </div>
          
          {progress !== undefined && <Progress value={progress} className="h-2" />}
          
          <p className="text-xs text-blue-700">{getPhaseDescription(phase)}</p>
          
          {status === "queued" && (
            <p className="text-xs text-blue-600 italic">
              La sincronización comenzará en breve...
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
