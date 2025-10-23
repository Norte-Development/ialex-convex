import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: Id<"cases">;
  parentFolderId?: Id<"folders">;
  onSuccess?: () => void;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  caseId,
  parentFolderId,
  onSuccess,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createFolder = useMutation(api.functions.folders.createFolder);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("El nombre de la carpeta es requerido");
      return;
    }

    setIsCreating(true);
    try {
      await createFolder({
        name: name.trim(),
        description: description.trim() || undefined,
        caseId,
        parentFolderId,
      });

      toast.success("Carpeta creada exitosamente");
      setName("");
      setDescription("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al crear la carpeta",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setName("");
        setDescription("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Carpeta</DialogTitle>
          <DialogDescription>
            Crea una nueva carpeta para organizar tus documentos
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              placeholder="Nombre de la carpeta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descripción de la carpeta"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creando..." : "Crear Carpeta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
