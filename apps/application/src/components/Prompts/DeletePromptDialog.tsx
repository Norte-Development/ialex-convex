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
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface DeletePromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptId: Id<"prompts"> | null;
  promptTitle?: string;
}

export function DeletePromptDialog({
  isOpen,
  onClose,
  promptId,
  promptTitle,
}: DeletePromptDialogProps) {
  const deletePrompt = useMutation(api.functions.prompts.deletePrompt);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!promptId) return;

    setIsDeleting(true);

    try {
      await deletePrompt({ promptId });
      toast.success("Prompt eliminado exitosamente");
      onClose();
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Error al eliminar el prompt");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El prompt{" "}
            {promptTitle && (
              <span className="font-semibold">"{promptTitle}"</span>
            )}{" "}
            será eliminado permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
