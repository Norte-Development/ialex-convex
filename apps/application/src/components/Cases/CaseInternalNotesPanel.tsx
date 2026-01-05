import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CaseNote, CreateNoteInput } from "types/caseNotes";
import { useCase } from "@/context/CaseContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import NoteForm from "./Notes/NoteForm";
import NoteCard from "./Notes/NoteCard";
import DeleteNoteDialog from "./Notes/DeleteNoteDialog";

export default function CaseInternalNotesPanel() {
  const { currentCase } = useCase();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CaseNote | null>(null);
  const [deletingNote, setDeletingNote] = useState<CaseNote | null>(null);

  // Queries
  const notes = useQuery(
    api.functions.caseNotes.listNotesByCase,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Mutations
  const createNote = useMutation(api.functions.caseNotes.createCaseNote);
  const updateNote = useMutation(api.functions.caseNotes.updateCaseNote);
  const deleteNote = useMutation(api.functions.caseNotes.deleteCaseNote);

  // Handlers
  const handleCreate = async (data: CreateNoteInput) => {
    if (!currentCase) return;

    try {
      await createNote(data);
      toast.success("Nota creada exitosamente");
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Error al crear la nota");
    }
  };

  const handleUpdate = async (data: CreateNoteInput) => {
    if (!editingNote) return;

    try {
      // Extract caseId from data as updateMutation doesn't accept it
      const { caseId, ...updateData } = data;
      await updateNote({
        noteId: editingNote._id,
        ...updateData,
      });
      toast.success("Nota actualizada exitosamente");
      setIsFormOpen(false);
      setEditingNote(null);
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Error al actualizar la nota");
    }
  };

  const handleDelete = async () => {
    if (!deletingNote) return;

    try {
      await deleteNote({ noteId: deletingNote._id });
      toast.success("Nota eliminada exitosamente");
      setDeletingNote(null);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Error al eliminar la nota");
    }
  };

  const openCreateForm = () => {
    setEditingNote(null);
    setIsFormOpen(true);
  };

  const openEditForm = (note: CaseNote) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };

  if (!currentCase) {
    return null;
  }

  const hasNotes = notes && notes.length > 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-gray-700">
            Notas Internas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasNotes
              ? `${notes.length} nota${notes.length > 1 ? "s" : ""}`
              : "Sin notas"}
          </p>
        </div>
        <Button
          onClick={openCreateForm}
          variant="default"
          size="sm"
          className="text-white bg-tertiary hover:bg-tertiary/90"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva
        </Button>
      </div>

      {/* Notes List or Empty State */}
      {hasNotes ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onEdit={() => openEditForm(note)}
              onDelete={() => setDeletingNote(note)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 px-4 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500">
            No hay notas. Haz clic en "Nueva" para agregar una.
          </p>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingNote ? "Editar Nota" : "Nueva Nota"}
            </DialogTitle>
            <DialogDescription>
              {editingNote
                ? "Modifica los datos de la nota"
                : "Completa los datos para crear una nueva nota"}
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            caseId={currentCase._id}
            initialData={editingNote}
            onSubmit={editingNote ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingNote(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteNoteDialog
        note={deletingNote}
        onConfirm={handleDelete}
        onCancel={() => setDeletingNote(null)}
      />
    </>
  );
}
