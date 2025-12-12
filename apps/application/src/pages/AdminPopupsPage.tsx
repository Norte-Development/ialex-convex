import { RequireAdminsOrg } from "@/components/Auth/RequireAdminsOrg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

import { PopupFormDialog } from "@/features/popups/PopupFormDialog";
import { PopupsTable } from "@/features/popups/PopupsTable";
import {
  emptyPopupForm,
  type PopupAudience,
  type PopupActionFormState,
  type PopupBillingMode,
  type PopupFormState,
  type PopupTemplate,
} from "@/features/popups/popupTypes";
import {
  parseOptionalDatetimeLocal,
  parseOptionalInt,
  toDatetimeLocal,
} from "@/features/popups/popupUtils";

export default function AdminPopupsPage() {
  const popups = useQuery(api.functions.popups.listPopupsAdmin, {});
  const createPopup = useMutation(api.functions.popups.createPopupAdmin);
  const updatePopup = useMutation(api.functions.popups.updatePopupAdmin);
  const setEnabled = useMutation(api.functions.popups.setPopupEnabledAdmin);
  const deletePopup = useMutation(api.functions.popups.deletePopupAdmin);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PopupFormState>(emptyPopupForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [editForm, setEditForm] = useState<PopupFormState>(emptyPopupForm);

  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const selectedPopup = useMemo(() => {
    if (!popups || !editingId) return null;
    return popups.find((p: any) => p._id === editingId) ?? null;
  }, [popups, editingId]);

  const normalizeActions = (actions: PopupActionFormState[]) => {
    const cleaned = (actions ?? [])
      .map((a) => {
        const label = (a.label ?? "").trim();
        if (!label) return null;

        if (a.type === "link") {
          const url = (a.url ?? "").trim();
          if (!url) return null;
          return {
            type: "link" as const,
            label,
            url,
            ...(a.newTab !== undefined ? { newTab: !!a.newTab } : {}),
          };
        }

        const billingMode = (a.billingMode ?? "plans") as PopupBillingMode;
        return {
          type: "billing" as const,
          label,
          billingMode,
        };
      })
      .filter(Boolean) as any[];

    return cleaned.length > 0 ? cleaned : undefined;
  };

  const openEdit = (popup: any) => {
    setEditingId(popup._id);
    setEditForm({
      key: popup.key ?? "",
      title: popup.title ?? "",
      body: popup.body ?? "",
      enabled: !!popup.enabled,
      template: (popup.template ?? "simple") as PopupTemplate,
      audience: (popup.audience ?? "all") as PopupAudience,
      badgeText: popup.badgeText ?? "",
      actions: Array.isArray(popup.actions) ? (popup.actions as any) : [],
      startAtLocal: toDatetimeLocal(popup.startAt),
      endAtLocal: toDatetimeLocal(popup.endAt),
      showAfterDays:
        popup.showAfterDays === undefined ? "" : String(popup.showAfterDays),
      frequencyDays:
        popup.frequencyDays === undefined ? "" : String(popup.frequencyDays),
      maxImpressions:
        popup.maxImpressions === undefined ? "" : String(popup.maxImpressions),
      priority: popup.priority === undefined ? "" : String(popup.priority),
    });
    setEditOpen(true);
  };

  const onToggleEnabled = async (popupId: any, next: boolean) => {
    const id = String(popupId);
    setBusyIds((p) => ({ ...p, [id]: true }));
    try {
      await setEnabled({ popupId, enabled: next });
      toast.success(next ? "Pop-up habilitado" : "Pop-up deshabilitado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el estado");
    } finally {
      setBusyIds((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
    }
  };

  const submitCreate = async (form: PopupFormState) => {
    if (!form.key.trim()) {
      toast.error("El campo ‘Key’ es obligatorio");
      return;
    }
    if (!form.title.trim()) {
      toast.error("El campo ‘Título’ es obligatorio");
      return;
    }
    if (!form.body.trim()) {
      toast.error("El campo ‘Mensaje’ es obligatorio");
      return;
    }

    const startAt = parseOptionalDatetimeLocal(form.startAtLocal);
    const endAt = parseOptionalDatetimeLocal(form.endAtLocal);
    if (startAt !== undefined && endAt !== undefined && startAt > endAt) {
      toast.error("La fecha de inicio no puede ser posterior al fin");
      return;
    }

    const actions = normalizeActions(form.actions);

    try {
      await createPopup({
        key: form.key,
        title: form.title,
        body: form.body,
        enabled: form.enabled,
        template: form.template,
        audience: form.audience,
        ...(form.badgeText.trim() ? { badgeText: form.badgeText.trim() } : {}),
        ...(actions ? { actions } : {}),
        ...(startAt !== undefined ? { startAt } : {}),
        ...(endAt !== undefined ? { endAt } : {}),
        ...(parseOptionalInt(form.showAfterDays) !== undefined
          ? { showAfterDays: parseOptionalInt(form.showAfterDays) }
          : {}),
        ...(parseOptionalInt(form.frequencyDays) !== undefined
          ? { frequencyDays: parseOptionalInt(form.frequencyDays) }
          : {}),
        ...(parseOptionalInt(form.maxImpressions) !== undefined
          ? { maxImpressions: parseOptionalInt(form.maxImpressions) }
          : {}),
        ...(parseOptionalInt(form.priority) !== undefined
          ? { priority: parseOptionalInt(form.priority) }
          : {}),
      });
      toast.success("Pop-up creado");
      setCreateForm(emptyPopupForm);
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el pop-up");
    }
  };

  const submitEdit = async (form: PopupFormState) => {
    if (!editingId) return;
    if (!form.key.trim()) {
      toast.error("El campo ‘Key’ es obligatorio");
      return;
    }
    if (!form.title.trim()) {
      toast.error("El campo ‘Título’ es obligatorio");
      return;
    }
    if (!form.body.trim()) {
      toast.error("El campo ‘Mensaje’ es obligatorio");
      return;
    }

    const startAt = parseOptionalDatetimeLocal(form.startAtLocal);
    const endAt = parseOptionalDatetimeLocal(form.endAtLocal);
    if (startAt !== undefined && endAt !== undefined && startAt > endAt) {
      toast.error("La fecha de inicio no puede ser posterior al fin");
      return;
    }

    const actions = normalizeActions(form.actions);

    try {
      await updatePopup({
        popupId: editingId,
        key: form.key,
        title: form.title,
        body: form.body,
        enabled: form.enabled,
        template: form.template,
        audience: form.audience,
        badgeText: form.badgeText.trim() ? form.badgeText.trim() : "",
        ...(actions ? { actions } : { actions: [] }),
        ...(startAt !== undefined ? { startAt } : {}),
        ...(endAt !== undefined ? { endAt } : {}),
        ...(parseOptionalInt(form.showAfterDays) !== undefined
          ? { showAfterDays: parseOptionalInt(form.showAfterDays) }
          : {}),
        ...(parseOptionalInt(form.frequencyDays) !== undefined
          ? { frequencyDays: parseOptionalInt(form.frequencyDays) }
          : {}),
        ...(parseOptionalInt(form.maxImpressions) !== undefined
          ? { maxImpressions: parseOptionalInt(form.maxImpressions) }
          : {}),
        ...(parseOptionalInt(form.priority) !== undefined
          ? { priority: parseOptionalInt(form.priority) }
          : {}),
      });
      toast.success("Pop-up actualizado");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el pop-up");
    }
  };

  const confirmDelete = async (popupId: any) => {
    const id = String(popupId);
    setBusyIds((p) => ({ ...p, [id]: true }));
    try {
      await deletePopup({ popupId });
      toast.success("Pop-up eliminado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar el pop-up");
    } finally {
      setBusyIds((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
    }
  };

  return (
    <RequireAdminsOrg>
      <div className="container mx-auto px-6 pt-20">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Pop-ups</h1>
            </div>
            <p className="text-muted-foreground">
              Panel para crear y administrar pop-ups informativos y de
              marketing.
            </p>
          </div>

          <PopupFormDialog
            mode="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            initialForm={createForm}
            triggerIcon="plus"
            triggerLabel="Crear pop-up"
            onSubmit={async (form) => {
              setCreateForm(form);
              await submitCreate(form);
            }}
          />
        </div>

        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Consejos: usá “Audiencia” para segmentar (Gratis/Trial) y
            “Frecuencia” para no molestar al usuario.
          </AlertDescription>
        </Alert>

        <PopupsTable
          popups={popups as any}
          busyIds={busyIds}
          onToggleEnabled={onToggleEnabled}
          onEdit={(p) => openEdit(p as any)}
          onDelete={(popupId) => confirmDelete(popupId)}
        />

        <PopupFormDialog
          mode="edit"
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setEditingId(null);
          }}
          initialForm={editForm}
          description={
            selectedPopup
              ? `Editando ${selectedPopup.key}`
              : "Usá un mensaje claro y corto. Esto aparece dentro de la app."
          }
          onSubmit={async (form) => {
            setEditForm(form);
            await submitEdit(form);
          }}
        />
      </div>
    </RequireAdminsOrg>
  );
}
