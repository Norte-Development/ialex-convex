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
import { Checkbox } from "@/components/ui/checkbox";
import { Button as UIButton } from "@/components/ui/button";
import { Plus, Trash2, ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  emptyPopupForm,
  type PopupActionFormState,
  type PopupFormState,
} from "./popupTypes";

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

  const addAction = () => {
    setForm((p) => {
      if ((p.actions?.length ?? 0) >= 2) return p;
      const next: PopupActionFormState = {
        type: "link",
        label: "",
        url: "",
        newTab: true,
      };
      return { ...p, actions: [...(p.actions ?? []), next] };
    });
  };

  const updateAction = (
    index: number,
    patch: Partial<PopupActionFormState>,
  ) => {
    setForm((p) => {
      const actions = [...(p.actions ?? [])];
      const current = actions[index];
      if (!current) return p;
      actions[index] = { ...current, ...patch };
      return { ...p, actions };
    });
  };

  const removeAction = (index: number) => {
    setForm((p) => {
      const actions = [...(p.actions ?? [])];
      actions.splice(index, 1);
      return { ...p, actions };
    });
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
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-template`}>Template</Label>
            <Select
              value={form.template}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, template: v as any }))
              }
            >
              <SelectTrigger id={`${mode}-template`}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="promo">Promo (tipo BlackFriday)</SelectItem>
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

          {/* <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${mode}-subtitle`}>Subtítulo (opcional)</Label>
            <Input
              id={`${mode}-subtitle`}
              placeholder="Ej: Disponible para planes Team"
              value={form.subtitle}
              onChange={(e) =>
                setForm((p) => ({ ...p, subtitle: e.target.value }))
              }
            />
          </div> */}
          {/* 
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${mode}-upper-body`}>Upper body (opcional)</Label>
            <Textarea
              id={`${mode}-upper-body`}
              placeholder="Texto corto arriba del mensaje principal."
              value={form.upperBody}
              onChange={(e) =>
                setForm((p) => ({ ...p, upperBody: e.target.value }))
              }
              rows={3}
            />
          </div> */}

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

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`${mode}-badge`}>Badge (opcional)</Label>
            <Input
              id={`${mode}-badge`}
              placeholder="Ej: 30% OFF"
              value={form.badgeText}
              onChange={(e) =>
                setForm((p) => ({ ...p, badgeText: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Se muestra como etiqueta en el template Promo.
            </p>
          </div>

          {/* Image Upload Section */}
          <div className="space-y-3 md:col-span-2 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Imagen (opcional)</p>
              <p className="text-xs text-muted-foreground">
                Imagen promocional para el pop-up. Recomendado: 800x600px.
              </p>
            </div>

            {form.imagePreviewUrl ? (
              <div className="relative inline-block">
                <img
                  src={form.imagePreviewUrl}
                  alt="Preview"
                  className="max-h-40 rounded-md border object-contain"
                />
                <UIButton
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      imageFile: null,
                      imagePreviewUrl: "",
                      existingImageBucket: undefined,
                      existingImageObject: undefined,
                    }))
                  }
                >
                  <X className="h-4 w-4" />
                </UIButton>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 transition-colors hover:border-muted-foreground/50 hover:bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click para seleccionar imagen
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const previewUrl = URL.createObjectURL(file);
                      setForm((p) => ({
                        ...p,
                        imageFile: file,
                        imagePreviewUrl: previewUrl,
                        existingImageBucket: undefined,
                        existingImageObject: undefined,
                      }));
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-3 md:col-span-2 rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">CTAs (opcional)</p>
                <p className="text-xs text-muted-foreground">
                  Hasta 2 acciones: link externo o billing.
                </p>
              </div>
              <UIButton
                type="button"
                variant="outline"
                disabled={submitting || (form.actions?.length ?? 0) >= 2}
                onClick={addAction}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar CTA
              </UIButton>
            </div>

            {(form.actions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin CTAs configurados.
              </p>
            ) : null}

            <div className="space-y-3">
              {(form.actions ?? []).map((action, idx) => (
                <div key={idx} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-medium">CTA #{idx + 1}</p>
                    <UIButton
                      type="button"
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => removeAction(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </UIButton>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={action.type}
                        onValueChange={(v) =>
                          updateAction(idx, {
                            type: v as any,
                            url: v === "link" ? (action.url ?? "") : undefined,
                            newTab:
                              v === "link"
                                ? (action.newTab ?? true)
                                : undefined,
                            billingMode:
                              v === "billing"
                                ? (action.billingMode ?? "plans")
                                : undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input
                        placeholder="Ej: Ver planes"
                        value={action.label}
                        onChange={(e) =>
                          updateAction(idx, { label: e.target.value })
                        }
                      />
                    </div>

                    {action.type === "link" ? (
                      <>
                        <div className="space-y-2 md:col-span-2">
                          <Label>URL</Label>
                          <Input
                            placeholder="https://..."
                            value={action.url ?? ""}
                            onChange={(e) =>
                              updateAction(idx, { url: e.target.value })
                            }
                          />
                        </div>

                        <div className="flex items-center gap-2 md:col-span-2">
                          <Checkbox
                            checked={action.newTab ?? true}
                            onCheckedChange={(v) =>
                              updateAction(idx, { newTab: Boolean(v) })
                            }
                            disabled={submitting}
                          />
                          <Label className="text-sm">
                            Abrir en nueva pestaña
                          </Label>
                        </div>
                      </>
                    ) : null}

                    {action.type === "billing" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Modo billing</Label>
                        <Select
                          value={action.billingMode ?? "plans"}
                          onValueChange={(v) =>
                            updateAction(idx, { billingMode: v as any })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plans">Ver planes</SelectItem>
                            <SelectItem value="checkout_individual">
                              Checkout Individual
                            </SelectItem>
                            <SelectItem value="checkout_team">
                              Checkout Team
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
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
