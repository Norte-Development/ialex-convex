import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: Id<"cases">;
  listId?: Id<"todoLists">;
  userId?: Id<"users">;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  caseId,
  listId,
  userId,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getOrCreateList = useMutation(api.functions.todos.getOrCreateCaseTodoList);
  const addTodoItem = useMutation(api.functions.todos.addTodoItem);

  const handleSubmit = async () => {
    if (!title.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      const targetListId = listId || await getOrCreateList({
        title: "Plan de Trabajo",
        caseId,
        createdBy: userId,
      });

      await addTodoItem({
        listId: targetListId,
        title: title.trim(),
        description: description.trim() || undefined,
        createdBy: userId,
      });

      toast.success("Tarea agregada");
      setTitle("");
      setDescription("");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Error al agregar tarea");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Tarea</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titulo *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Revisar documentacion del cliente"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Descripcion (opcional)</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? "Agregando..." : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
