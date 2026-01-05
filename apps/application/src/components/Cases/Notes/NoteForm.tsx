import { useState, useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { CaseNote, CreateNoteInput, CaseNoteType } from "@/types/caseNotes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, StarOff } from "lucide-react";

const NOTE_TYPES = [
  { value: "decisión", label: "Decisión", color: "bg-blue-100 text-blue-800" },
  {
    value: "recordatorio",
    label: "Recordatorio",
    color: "bg-yellow-100 text-yellow-800",
  },
  { value: "acuerdo", label: "Acuerdo", color: "bg-green-100 text-green-800" },
  {
    value: "información",
    label: "Información",
    color: "bg-gray-100 text-gray-800",
  },
  { value: "otro", label: "Otro", color: "bg-purple-100 text-purple-800" },
] as const;

interface NoteFormProps {
  caseId: Id<"cases">;
  initialData?: CaseNote | null;
  onSubmit: (data: CreateNoteInput) => void | Promise<void>;
  onCancel: () => void;
}

export default function NoteForm({
  caseId,
  initialData,
  onSubmit,
  onCancel,
}: NoteFormProps) {
  const [formData, setFormData] = useState<CreateNoteInput>({
    caseId,
    content: "",
    title: "",
    type: "información",
    isImportant: false,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        caseId,
        content: initialData.content,
        title: initialData.title || "",
        type: initialData.type,
        isImportant: initialData.isImportant,
      });
    }
  }, [initialData, caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Título (opcional)
        </label>
        <Input
          placeholder="Ej: Acuerdo con cliente"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      {/* Type and Importance */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Tipo *
          </label>
          <Select
            value={formData.type}
            onValueChange={(value: CaseNoteType) =>
              setFormData({ ...formData, type: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {NOTE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Importancia
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start h-10"
            onClick={() =>
              setFormData({
                ...formData,
                isImportant: !formData.isImportant,
              })
            }
          >
            {formData.isImportant ? (
              <Star className="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-4 w-4 mr-2" />
            )}
            {formData.isImportant ? "Importante" : "Normal"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Contenido *
        </label>
        <Textarea
          placeholder="Escribe el contenido de la nota..."
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          className="resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!formData.content.trim()}
          className="bg-tertiary text-white hover:bg-tertiary/80"
        >
          {initialData ? "Guardar Cambios" : "Crear Nota"}
        </Button>
      </div>
    </form>
  );
}
