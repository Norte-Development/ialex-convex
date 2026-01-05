import { CaseNote } from "@/types/caseNotes";
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

interface DeleteNoteDialogProps {
  note: CaseNote | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function DeleteNoteDialog({
  note,
  onConfirm,
  onCancel,
}: DeleteNoteDialogProps) {
  return (
    <AlertDialog open={!!note} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. La nota será eliminada permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
