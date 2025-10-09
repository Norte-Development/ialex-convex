import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { Doc } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface EditFolderDialogProps {
  folder: Doc<"libraryFolders"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = [
  { value: "bg-blue-500", label: "Azul" },
  { value: "bg-green-500", label: "Verde" },
  { value: "bg-purple-500", label: "Morado" },
  { value: "bg-red-500", label: "Rojo" },
  { value: "bg-orange-500", label: "Naranja" },
  { value: "bg-yellow-500", label: "Amarillo" },
];

export function EditFolderDialog({
  folder,
  open,
  onOpenChange,
}: EditFolderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0].value);
  const [isLoading, setIsLoading] = useState(false);

  const updateFolder = useMutation(
    api.functions.libraryFolders.updateLibraryFolder
  );

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setDescription(folder.description || "");
      setColor(folder.color || COLORS[0].value);
    }
  }, [folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!folder || !name.trim()) {
      toast.error("El nombre de la carpeta es requerido");
      return;
    }

    setIsLoading(true);

    try {
      await updateFolder({
        folderId: folder._id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      toast.success("Carpeta actualizada exitosamente");

      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo actualizar la carpeta");
    } finally {
      setIsLoading(false);
    }
  };

  if (!folder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Carpeta</DialogTitle>
          <DialogDescription>
            Actualiza la información de la carpeta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la carpeta"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-full ${c.value} ${
                      color === c.value
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
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
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

