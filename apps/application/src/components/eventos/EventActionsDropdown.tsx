import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, CheckCircle, XCircle, Trash2 } from "lucide-react";

interface EventActionsDropdownProps {
  eventStatus: string;
  onMarkComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export default function EventActionsDropdown({
  eventStatus,
  onMarkComplete,
  onCancel,
  onDelete,
}: EventActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {eventStatus === "programado" && (
          <>
            <DropdownMenuItem onClick={onMarkComplete}>
              <CheckCircle size={14} className="mr-2" />
              Completar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCancel}>
              <XCircle size={14} className="mr-2" />
              Cancelar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 size={14} className="mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
