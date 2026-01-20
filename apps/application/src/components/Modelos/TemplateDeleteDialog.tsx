import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateDeleteDialogProps {
  templateId: Id<"modelos"> | null;
  templateName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TemplateDeleteDialog({
  templateId,
  templateName,
  isOpen,
  onClose,
  onSuccess,
}: TemplateDeleteDialogProps) {
  const deleteModelo = useMutation(api.functions.templates.deleteModelo);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!templateId) return;

    setIsDeleting(true);

    try {
      await deleteModelo({ modeloId: templateId });
      toast.success("Modelo eliminado correctamente");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar el modelo",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar modelo</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estas seguro de que deseas eliminar el modelo{" "}
            <span className="font-semibold">"{templateName}"</span>? Esta accion
            no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
