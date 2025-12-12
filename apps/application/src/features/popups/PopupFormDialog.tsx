import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { emptyPopupForm, type PopupFormState } from "./popupTypes";

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialForm?: PopupFormState;
  triggerLabel?: string;
  triggerIcon?: "plus" | "none";
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (form: PopupFormState) => Promise<void> | void;
};

export function PopupFormDialog(props: Props) {
  const {
    mode,
    open,
    onOpenChange,
    initialForm,
    triggerLabel,
    triggerIcon,
    title,
    description,
    submitLabel,
    onSubmit,
  } = props;

  const [form, setForm] = useState<PopupFormState>(
    initialForm ?? emptyPopupForm,
  );
  const [submitting, setSubmitting] = useState(false);

  const effectiveTitle = useMemo(() => {
    if (title) return title;
    return mode === "create" ? "Crear pop-up" : "Editar pop-up";
  }, [mode, title]);

  const effectiveDescription = useMemo(() => {
    if (description !== undefined) return description;
    return "Usá un mensaje claro y corto. Esto aparece dentro de la app.";
  }, [description]);

  const effectiveSubmitLabel = useMemo(() => {
    if (submitLabel) return submitLabel;
    return mode === "create" ? "Crear" : "Guardar";
  }, [mode, submitLabel]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setForm(initialForm ?? emptyPopupForm);
      return;
    }
    if (initialForm) setForm(initialForm);
  }, [open, mode, initialForm]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {mode === "create" ? (
        <DialogTrigger asChild>
          <Button disabled={submitting}>
            {triggerIcon === "plus" ? <Plus className="h-4 w-4 mr-2" /> : null}
            {triggerLabel ?? "Crear pop-up"}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{effectiveTitle}</DialogTitle>
          {effectiveDescription ? (
            <DialogDescription>{effectiveDescription}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-key`}>Key</Label>
            <Input
              id={`${mode}-key`}
              placeholder="blackfriday-2025"
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Identificador estable (no usar espacios).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-audience`}>Audiencia</Label>
            <Select
              value={form.audience}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, audience: v as any }))
              }
            >
              <SelectTrigger id={`${mode}-audience`}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="free">Gratis</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="free_or_trial">Gratis o Trial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${mode}-title`}>Título</Label>
            <Input
              id={`${mode}-title`}
              placeholder="Novedad: invitá a tu equipo"
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${mode}-body`}>Mensaje</Label>
            <Textarea
              id={`${mode}-body`}
              placeholder="Sumá colaboradores para organizar casos y documentos."
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-start`}>Inicio (opcional)</Label>
            <Input
              id={`${mode}-start`}
              type="datetime-local"
              value={form.startAtLocal}
              onChange={(e) =>
                setForm((p) => ({ ...p, startAtLocal: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-end`}>Fin (opcional)</Label>
            <Input
              id={`${mode}-end`}
              type="datetime-local"
              value={form.endAtLocal}
              onChange={(e) =>
                setForm((p) => ({ ...p, endAtLocal: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-show-after`}>
              Mostrar después de (días)
            </Label>
            <Input
              id={`${mode}-show-after`}
              inputMode="numeric"
              placeholder="Ej: 2"
              value={form.showAfterDays}
              onChange={(e) =>
                setForm((p) => ({ ...p, showAfterDays: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Vacío = se puede mostrar desde el día 1.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-frequency`}>Frecuencia (días)</Label>
            <Input
              id={`${mode}-frequency`}
              inputMode="numeric"
              placeholder="Ej: 7"
              value={form.frequencyDays}
              onChange={(e) =>
                setForm((p) => ({ ...p, frequencyDays: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Vacío = se puede repetir sin espera.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-max`}>Máx. impresiones</Label>
            <Input
              id={`${mode}-max`}
              inputMode="numeric"
              placeholder="Ej: 3"
              value={form.maxImpressions}
              onChange={(e) =>
                setForm((p) => ({ ...p, maxImpressions: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">Vacío = sin límite.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-priority`}>Prioridad</Label>
            <Input
              id={`${mode}-priority`}
              inputMode="numeric"
              placeholder="Ej: 10"
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({ ...p, priority: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Número más alto = se muestra primero.
            </p>
          </div>

          <div className="flex items-center justify-between md:col-span-2 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Habilitado</p>
              <p className="text-xs text-muted-foreground">
                Si está apagado, nunca se mostrará.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button disabled={submitting} onClick={submit}>
            {effectiveSubmitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
