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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreateEditPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  promptId?: Id<"prompts"> | null;
  mode: "create" | "edit";
}

export function CreateEditPromptDialog({
  isOpen,
  onClose,
  promptId,
  mode,
}: CreateEditPromptDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [category, setCategory] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Mutations
  const createPrompt = useMutation(api.functions.prompts.createPrompt);
  const updatePrompt = useMutation(api.functions.prompts.updatePrompt);

  // Queries
  const categories = useQuery(api.functions.prompts.getPromptCategories);
  const existingPrompt = useQuery(
    api.functions.prompts.getPrompt,
    promptId && mode === "edit" ? { promptId } : "skip",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing prompt data when editing
  useEffect(() => {
    if (mode === "edit" && existingPrompt) {
      setTitulo(existingPrompt.titulo);
      setCategory(existingPrompt.category);
      setDescripcion(existingPrompt.descripcion);
      setPrompt(existingPrompt.prompt);
      setTags(existingPrompt.tags ?? []);
    }
  }, [mode, existingPrompt]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTitulo("");
      setCategory("");
      setDescripcion("");
      setPrompt("");
      setTags([]);
      setNewTag("");
    }
  }, [isOpen]);

  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    if (!category.trim()) {
      toast.error("La categoría es obligatoria");
      return;
    }

    if (!descripcion.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }

    if (!prompt.trim()) {
      toast.error("El texto del prompt es obligatorio");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createPrompt({
          titulo: titulo.trim(),
          category: category.trim(),
          descripcion: descripcion.trim(),
          prompt: prompt.trim(),
          isPublic: false, // Personal prompts are always private
          tags: tags.length > 0 ? tags : undefined,
        });
        toast.success("Prompt creado exitosamente");
      } else if (mode === "edit" && promptId) {
        await updatePrompt({
          promptId,
          titulo: titulo.trim(),
          category: category.trim(),
          descripcion: descripcion.trim(),
          prompt: prompt.trim(),
          tags: tags.length > 0 ? tags : undefined,
        });
        toast.success("Prompt actualizado exitosamente");
      }

      onClose();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error(
        mode === "create"
          ? "Error al crear el prompt"
          : "Error al actualizar el prompt",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Crear Nuevo Prompt" : "Editar Prompt"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Crea un prompt personalizado para usar en tus casos"
              : "Modifica los detalles de tu prompt personalizado"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="titulo"
              placeholder="Ej: Redacta una demanda por daños y perjuicios"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {titulo.length}/200 caracteres
            </p>
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoría <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {/* Combine categories from backend with default ones, removing duplicates */}
                {Array.from(
                  new Set([
                    ...(categories ?? []),
                    "Civil",
                    "Penal",
                    "Laboral",
                    "Familia",
                    "Comercial",
                    "Constitucional",
                    "Procesal",
                    "Otro",
                  ]),
                )
                  .sort()
                  .map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">
              Descripción <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Breve descripción de lo que hace este prompt"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {descripcion.length}/300 caracteres
            </p>
          </div>

          {/* Prompt Text */}
          <div className="space-y-2">
            <Label htmlFor="prompt">
              Texto del Prompt <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="prompt"
              placeholder="Redacta [tipo de documento] para [situación], en [jurisdicción]..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Usa [corchetes] para indicar placeholders que necesitan ser
              reemplazados
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Etiquetas (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Agregar etiqueta"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "create" ? "Crear Prompt" : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
