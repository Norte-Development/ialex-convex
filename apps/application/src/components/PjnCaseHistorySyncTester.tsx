import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
} from "lucide-react";

type SyncResult =
  | {
      status: "OK";
      movimientosSynced: number;
      documentsSynced: number;
      stats: {
        movimientosCount: number;
        docsCount: number;
        downloadErrors: number;
        durationMs: number;
      };
      lastSyncAt: number;
    }
  | {
      status: "AUTH_REQUIRED";
      reason: string;
      details?: unknown;
    }
  | {
      status: "ERROR";
      error: string;
      code?: string;
    };

export function PjnCaseHistorySyncTester() {
  const syncCaseHistoryForCase = useAction(api.pjn.caseHistory.syncCaseHistoryForCase);

  const [caseIdInput, setCaseIdInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    if (!caseIdInput) {
      toast.error("Ingresá un ID de caso (Id<'cases'>) para sincronizar");
      return;
    }

    setIsSyncing(true);
    setResult(null);

    try {
      const syncResult = await syncCaseHistoryForCase({
        caseId: caseIdInput as Id<"cases">,
      });

      setResult(syncResult as SyncResult);

      if (syncResult.status === "OK") {
        toast.success(
          `Sincronización exitosa. Movimientos: ${syncResult.movimientosSynced}, documentos: ${syncResult.documentsSynced}`,
        );
      } else if (syncResult.status === "AUTH_REQUIRED") {
        toast.error(`Autenticación requerida: ${syncResult.reason}`);
      } else {
        toast.error(`Error al sincronizar: ${syncResult.error}`);
      }
    } catch (error) {
      console.error("Error syncing PJN case history:", error);
      toast.error("Error inesperado al sincronizar historial de expediente");
      setResult({
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDateTime = (timestamp: number | undefined) => {
    if (!timestamp || Number.isNaN(timestamp)) return "N/A";
    try {
      return new Date(timestamp).toLocaleString("es-AR");
    } catch {
      return String(timestamp);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Sincronización de Historial PJN por Caso</CardTitle>
        <CardDescription>
          Ejecuta la acción de Convex que llama al endpoint
          <code className="mx-1 text-xs rounded bg-muted px-1 py-0.5">
            /scrape/case-history/details
          </code>
          usando el FRE del caso y persiste los movimientos/documentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="caseId">
            ID de Caso (Id&lt;&quot;cases&quot;&gt;)
          </Label>
          <Input
            id="caseId"
            placeholder="Ej: jq1c6q8q0c5r2s1d3g4f6h7k"
            value={caseIdInput}
            onChange={(e) => setCaseIdInput(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            El caso debe tener el campo FRE configurado y el usuario actual debe
            tener acceso avanzado para poder sincronizar.
          </p>
        </div>

        <Button
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Ejecutar syncCaseHistoryForCase
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 space-y-3">
            {result.status === "OK" && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="space-y-2 text-emerald-800 dark:text-emerald-300">
                  <p className="font-semibold">
                    Sincronización completada correctamente
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>
                        Movimientos sincronizados:{" "}
                        <span className="font-mono">
                          {result.movimientosSynced}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>
                        Documentos sincronizados:{" "}
                        <span className="font-mono">
                          {result.documentsSynced}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        Duración scrape:{" "}
                        <span className="font-mono">
                          {result.stats.durationMs} ms
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Errores de descarga:{" "}
                        <span className="font-mono">
                          {result.stats.downloadErrors}
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="text-xs">
                    Última sync registrada en el caso:{" "}
                    <span className="font-mono">
                      {formatDateTime(result.lastSyncAt)}
                    </span>
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {result.status === "AUTH_REQUIRED" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold">
                    Autenticación requerida en PJN / scraper
                  </p>
                  <p className="text-sm mt-1">{result.reason}</p>
                </AlertDescription>
              </Alert>
            )}

            {result.status === "ERROR" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  <p className="font-semibold">
                    Error al ejecutar syncCaseHistoryForCase
                  </p>
                  <p className="text-sm">{result.error}</p>
                  {"code" in result && result.code && (
                    <p className="text-xs opacity-75">
                      Código:{" "}
                      <span className="font-mono">{result.code}</span>
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

