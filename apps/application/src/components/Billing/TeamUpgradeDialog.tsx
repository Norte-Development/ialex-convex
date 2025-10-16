import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Users } from "lucide-react";

interface TeamUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgradeTeamAutoCreate: () => void;
  isUpgrading: boolean;
  firmName?: string | null;
  userName?: string;
}

/**
 * Dialog shown when a free user tries to upgrade to Premium Team
 * Explains we'll auto-create a team for them and upgrade it
 */
export function TeamUpgradeDialog({
  open,
  onOpenChange,
  onUpgradeTeamAutoCreate,
  isUpgrading,
  firmName,
  userName,
}: TeamUpgradeDialogProps) {
  const teamName = firmName || `Estudio ${userName || "Legal"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="size-6 text-purple-600" />
            <DialogTitle>Actualizar a Premium Equipo</DialogTitle>
          </div>
          <DialogDescription>
            Crearemos automáticamente tu equipo y lo actualizaremos a Premium
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-purple-300 bg-purple-50">
            <Info className="size-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              ¡Proceso simplificado! Crearemos un equipo para ti automáticamente.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Lo que haremos por ti:</h4>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                  1
                </span>
                <span>
                  <strong>Crear tu equipo</strong> - Automáticamente crearemos "{teamName}"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                  2
                </span>
                <span>
                  <strong>Te agregamos como administrador</strong> - Tendrás control total del equipo
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                  3
                </span>
                <span>
                  <strong>Redirigir a checkout</strong> - Completar el pago de Premium Equipo
                </span>
              </li>
            </ol>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <strong>Incluye:</strong> Hasta 6 miembros de equipo, GPT-5 para todos,
              200 documentos de biblioteca, 200 GB de almacenamiento.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 <strong>Nota:</strong> Podrás cambiar el nombre del equipo después en la configuración.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpgrading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onUpgradeTeamAutoCreate}
            disabled={isUpgrading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isUpgrading ? "Creando equipo..." : "Crear Equipo y Actualizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

