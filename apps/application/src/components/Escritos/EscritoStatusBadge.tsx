import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle2, FileEdit, ChevronDown } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/context/CasePermissionsContext";
import { ACCESS_LEVELS } from "@/permissions/types";

type EscritoStatus = "borrador" | "terminado";

interface EscritoStatusBadgeProps {
  escritoId: Id<"escritos">;
  currentStatus: EscritoStatus;
}

const STATUS_CONFIG = {
  borrador: {
    label: "Borrador",
    icon: FileEdit,
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    hoverClass: "hover:bg-yellow-200",
  },
  terminado: {
    label: "Terminado",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 border-green-300",
    hoverClass: "hover:bg-green-200",
  },
} as const;

export function EscritoStatusBadge({
  escritoId,
  currentStatus,
}: EscritoStatusBadgeProps) {
  const { hasAccessLevel } = usePermissions();
  const updateEscrito = useMutation(api.functions.documents.updateEscrito);
  const config = STATUS_CONFIG[currentStatus];
  const Icon = config.icon;

  // Require ADVANCED level to change status
  const canEdit = hasAccessLevel(ACCESS_LEVELS.ADVANCED);

  const handleStatusChange = async (newStatus: EscritoStatus) => {
    if (newStatus === currentStatus) return;

    try {
      await updateEscrito({
        escritoId,
        status: newStatus,
      });
      const newConfig = STATUS_CONFIG[newStatus];
      toast.success(`Estado cambiado a "${newConfig.label}"`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al cambiar el estado del escrito");
    }
  };

  if (!canEdit) {
    return (
      <Badge
        variant="outline"
        className={cn("flex items-center gap-1.5", config.className)}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center gap-1.5 h-8 font-medium",
            config.className,
            config.hoverClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {config.label}
          <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(
          Object.entries(STATUS_CONFIG) as [
            EscritoStatus,
            (typeof STATUS_CONFIG)[EscritoStatus],
          ][]
        ).map(([status, statusConfig]) => {
          const StatusIcon = statusConfig.icon;
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={status === currentStatus}
              className="flex items-center gap-2"
            >
              <StatusIcon className="h-4 w-4" />
              <span>{statusConfig.label}</span>
              {status === currentStatus && (
                <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-green-600" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
