import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/context/CasePermissionsContext";
import { ACCESS_LEVELS } from "@/permissions/types";

interface CaseStatusSelectorProps {
  caseId: Id<"cases">;
  currentStatus:
    | "pendiente"
    | "en progreso"
    | "completado"
    | "archivado"
    | "cancelado";
}

export default function CaseStatusSelector({
  caseId,
  currentStatus,
}: CaseStatusSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateCase = useMutation(api.functions.cases.updateCase);
  const { hasAccessLevel } = usePermissions();

  const statusOptions = [
    { value: "pendiente", label: "Pendiente", variant: "secondary" as const },
    { value: "en progreso", label: "En Progreso", variant: "default" as const },
    { value: "completado", label: "Completado", variant: "outline" as const },
    { value: "archivado", label: "Archivado", variant: "outline" as const },
    { value: "cancelado", label: "Cancelado", variant: "outline" as const },
  ];

  const currentStatusOption = statusOptions.find(
    (option) => option.value === currentStatus,
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
      toast.error("No tienes permisos para cambiar el estado del caso");
      return;
    }

    if (newStatus === currentStatus) return;

    setIsUpdating(true);
    try {
      await updateCase({
        caseId,
        status: newStatus as any,
      });
      toast.success("Estado del caso actualizado");
    } catch (error) {
      console.error("Error updating case status:", error);
      toast.error("No se pudo actualizar el estado del caso");
    } finally {
      setIsUpdating(false);
    }
  };

  // Si no tiene permisos de escritura, solo mostrar el badge
  if (!hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
    return (
      <Badge
        variant={currentStatusOption?.variant || "secondary"}
        className="font-normal"
      >
        {currentStatusOption?.label || currentStatus}
      </Badge>
    );
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-auto h-auto px-3 py-1 border-0 hover:bg-accent focus:ring-0 focus:ring-offset-0">
        <SelectValue>
          <Badge
            variant={currentStatusOption?.variant || "secondary"}
            className="font-normal cursor-pointer"
          >
            {isUpdating
              ? "Actualizando..."
              : currentStatusOption?.label || currentStatus}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <Badge variant={option.variant} className="font-normal">
              {option.label}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
