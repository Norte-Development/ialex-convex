import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
  CheckCircle2,
  FileText,
  Users,
  Database,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";

interface MigrationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrationComplete: () => void;
}

export function MigrationProgressDialog({
  open,
  onOpenChange,
  onMigrationComplete,
}: MigrationProgressDialogProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const migrationStatus = useQuery(api.functions.migration.getMyMigrationStatus);
  const migrationProgress = useQuery(api.functions.migration.getMyMigrationProgress);
  const startMigration = useAction(api.functions.migration.startMyMigration);

  // Auto-refresh progress every 3 seconds
  useEffect(() => {
    if (hasStarted && migrationStatus?.status === "in_progress") {
      const interval = setInterval(() => {
        // The useQuery will automatically refetch
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [hasStarted, migrationStatus?.status]);

  // Check if migration completed
  useEffect(() => {
    if (migrationStatus?.status === "completed" && hasStarted) {
      toast.success("¡Migración completada exitosamente!");
      setTimeout(() => {
        onMigrationComplete();
      }, 2000);
    }
  }, [migrationStatus?.status, hasStarted, onMigrationComplete]);

  const handleStartMigration = async () => {
    setIsStarting(true);

    try {
      const result = await startMigration();
      
      if (result.success) {
        toast.success(result.message);
        setHasStarted(true);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Error starting migration:", error);
      toast.error(error.message || "Error al iniciar la migración");
    } finally {
      setIsStarting(false);
    }
  };

  const status = migrationStatus?.status || "pending";
  const progress = migrationProgress;

  const getStatusDisplay = () => {
    switch (status) {
      case "pending":
        return {
          color: "text-yellow-500",
          bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
          icon: AlertCircle,
          text: "Esperando inicio",
        };
      case "in_progress":
        return {
          color: "text-blue-500",
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          icon: Loader2,
          text: "Migrando datos...",
          spin: true,
        };
      case "completed":
        return {
          color: "text-green-500",
          bgColor: "bg-green-50 dark:bg-green-950/20",
          icon: CheckCircle2,
          text: "Migración completada",
        };
      case "failed":
        return {
          color: "text-red-500",
          bgColor: "bg-red-50 dark:bg-red-950/20",
          icon: AlertCircle,
          text: "Error en la migración",
        };
      default:
        return {
          color: "text-gray-500",
          bgColor: "bg-gray-50 dark:bg-gray-950/20",
          icon: AlertCircle,
          text: "Estado desconocido",
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  const totalItems =
    (progress?.casesCount || 0) +
    (progress?.clientsCount || 0) +
    (progress?.documentsCount || 0) +
    (progress?.libraryDocumentsCount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showCloseButton={status === "completed"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Database className="h-6 w-6 text-blue-500" />
            Progreso de Migración
          </DialogTitle>
          <DialogDescription>
            {status === "pending"
              ? "Haz clic en 'Iniciar Migración' para comenzar el proceso"
              : status === "in_progress"
              ? "Tu migración está en progreso. Puedes cerrar este diálogo y seguir usando la aplicación."
              : status === "completed"
              ? "Tu migración se completó exitosamente"
              : "Hubo un problema con la migración"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Banner */}
          <Alert className={statusDisplay.bgColor}>
            <StatusIcon
              className={`h-5 w-5 ${statusDisplay.color} ${statusDisplay.spin ? "animate-spin" : ""}`}
            />
            <AlertDescription>
              <p className={`font-semibold ${statusDisplay.color}`}>{statusDisplay.text}</p>
            </AlertDescription>
          </Alert>

          {/* Progress bars */}
          {(status === "in_progress" || status === "completed") && progress && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Total de elementos migrados</span>
                  <span className="text-sm font-semibold">{totalItems}</span>
                </div>
                <Progress value={status === "completed" ? 100 : 50} className="h-2" />
              </div>

              {/* Breakdown */}
              <div className="grid gap-3 mt-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Expedientes</span>
                  </div>
                  <span className="text-sm font-semibold">{progress.casesCount}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Clientes</span>
                  </div>
                  <span className="text-sm font-semibold">{progress.clientsCount}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Documentos (Expedientes)</span>
                  </div>
                  <span className="text-sm font-semibold">{progress.documentsCount}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Documentos (Biblioteca)</span>
                  </div>
                  <span className="text-sm font-semibold">{progress.libraryDocumentsCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Start migration button */}
          {status === "pending" && !hasStarted && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleStartMigration}
                disabled={isStarting}
                size="lg"
                className="gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Iniciar Migración
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Completed actions */}
          {status === "completed" && (
            <div className="flex justify-center pt-4">
              <Button onClick={() => onOpenChange(false)} size="lg">
                Continuar a la Aplicación
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

