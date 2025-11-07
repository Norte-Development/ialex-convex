import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Case } from "types/cases";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";

interface EditCaseDialogProps {
  case_: Case | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCaseDialog({
  case_,
  open,
  onOpenChange,
}: EditCaseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const updateCase = useMutation(api.functions.cases.updateCase);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    expedientNumber: "",
    status: "pendiente" as
      | "pendiente"
      | "en progreso"
      | "completado"
      | "archivado"
      | "cancelado",
    priority: "medium" as "low" | "medium" | "high",
    category: "",
  });

  // Actualizar formulario cuando cambia el caso
  useEffect(() => {
    if (case_) {
      setFormData({
        title: case_.title || "",
        description: case_.description || "",
        expedientNumber: case_.expedientNumber || "",
        status: case_.status || "pendiente",
        priority: case_.priority || "medium",
        category: case_.category || "",
      });
    }
  }, [case_]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!case_) return;

    if (!formData.title.trim()) {
      toast.error("El título es requerido");
      return;
    }

    setIsLoading(true);

    try {
      await updateCase({
        caseId: case_._id as Id<"cases">,
        title: formData.title,
        description: formData.description || undefined,
        expedientNumber: formData.expedientNumber || undefined,
        status: formData.status,
        priority: formData.priority,
        category: formData.category || undefined,
      });

      toast.success("Caso actualizado exitosamente");
      // Small delay to avoid portal teardown races before closing dialog
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Close any open floating layers before closing dialog to prevent NotFoundError
      closeFloatingLayers();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating case:", error);
      toast.error("Error al actualizar el caso: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent dialog closing while submitting
  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Caso</DialogTitle>
          <DialogDescription>
            Modifica la información del caso "{case_?.title}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título del Caso *</Label>
              <Input
                id="title"
                placeholder="Ej: Contrato de Alquiler"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Descripción detallada del caso..."
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                rows={3}
              />
            </div>

            {/* Número de Expediente */}
            <div className="space-y-2">
              <Label htmlFor="expedientNumber">Número de Expediente</Label>
              <Input
                id="expedientNumber"
                placeholder="Ej: EXP-2024-12345"
                value={formData.expedientNumber}
                onChange={(e) =>
                  handleInputChange("expedientNumber", e.target.value)
                }
              />
            </div>

            {/* Estado y Prioridad */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en progreso">En Progreso</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="archivado">Archivado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridad *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    handleInputChange("priority", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                placeholder="Ej: Derecho Civil, Derecho Penal..."
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
