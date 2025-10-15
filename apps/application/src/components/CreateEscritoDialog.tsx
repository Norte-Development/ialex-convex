import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { PermissionToasts } from "@/lib/permissionToasts";
import { useBillingLimit, UpgradeModal, LimitWarningBanner } from "@/components/Billing";

interface CreateEscritoDialogProps {
  open?: boolean;
  setOpen: (open: boolean) => void;
  onEscritoCreated?: (escritoId: Id<"escritos">) => void;
}

export function CreateEscritoDialog({
  open,
  setOpen,
  onEscritoCreated,
}: CreateEscritoDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { currentCase } = useCase();
  const { can } = usePermissions();

  const createEscrito = useMutation(api.functions.documents.createEscrito);

  // Get current escritos for the case
  const escritos = useQuery(
    api.functions.documents.getEscritos,
    currentCase?._id ? { caseId: currentCase._id as Id<"cases"> } : "skip"
  );
  const currentEscritoCount = escritos?.length || 0;

  // Check escrito limit
  const { allowed, isWarning, percentage, reason, currentCount, limit } = useBillingLimit("escritosPerCase", {
    currentCount: currentEscritoCount,
  });

  // Get user plan for upgrade modal
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  const [formData, setFormData] = useState({
    title: "",
    presentationDate: "",
    courtName: "",
    expedientNumber: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      presentationDate: "",
      courtName: "",
      expedientNumber: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check permissions first
    if (!can.escritos.write) {
      PermissionToasts.escritos.create();
      return;
    }

    if (!formData.title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    if (!currentCase) {
      toast.error("No hay un caso seleccionado");
      return;
    }

    // Check billing limit before creating escrito
    if (!allowed) {
      toast.error("Límite alcanzado", {
        description: reason,
      });
      setShowUpgradeModal(true);
      return;
    }

    setIsLoading(true);

    try {
      // Generate a unique ID for the ProseMirror document
      const prosemirrorId = crypto.randomUUID();
      
      const escritoData = {
        title: formData.title.trim(),
        caseId: currentCase._id as Id<"cases">,
        prosemirrorId: prosemirrorId,
        presentationDate: formData.presentationDate
          ? new Date(formData.presentationDate).getTime()
          : undefined,
        courtName: formData.courtName.trim() || undefined,
        expedientNumber: formData.expedientNumber.trim() || undefined,
      };

      const result = await createEscrito(escritoData);
      
      // Extract the escritoId from the result object
      const escritoId = result.escritoId;

      resetForm();
      setOpen(false);
      toast.success("Escrito creado exitosamente");

      // Call the callback with the new escrito ID
      if (onEscritoCreated) {
        onEscritoCreated(escritoId);
      }
    } catch (error) {
      console.error("Error creating escrito:", error);
      toast.error("Error al crear el escrito. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <DialogTitle>Crear Nuevo Escrito</DialogTitle>
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
              {currentCount}/{limit === Infinity ? "∞" : limit}
            </span>
          </div>
          <DialogDescription>
            Crea un nuevo escrito legal para el caso actual. Los campos marcados
            con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner if approaching limit */}
        {isWarning && (
          <LimitWarningBanner
            limitType="escritosPerCase"
            percentage={percentage}
            currentCount={currentCount}
            limit={limit}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ej: Demanda por Daños y Perjuicios"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courtName">Tribunal</Label>
              <Input
                id="courtName"
                placeholder="Ej: Juzgado Civil N° 1"
                value={formData.courtName}
                onChange={(e) => handleInputChange("courtName", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expedientNumber">N° Expediente</Label>
              <Input
                id="expedientNumber"
                placeholder="Ej: EXP-2024-001"
                value={formData.expedientNumber}
                onChange={(e) =>
                  handleInputChange("expedientNumber", e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="presentationDate">Fecha de Presentación</Label>
            <Input
              id="presentationDate"
              type="date"
              value={formData.presentationDate}
              onChange={(e) =>
                handleInputChange("presentationDate", e.target.value)
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear Escrito"}
            </Button>
          </DialogFooter>
        </form>

        {/* Upgrade Modal */}
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          reason={reason}
          currentPlan={userPlan || "free"}
          recommendedPlan="premium_individual"
        />
      </DialogContent>
    </Dialog>
  );
}
