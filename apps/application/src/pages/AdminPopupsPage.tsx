import { RequireAdminsOrg } from "@/components/Auth/RequireAdminsOrg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

type PopupAudience = "all" | "free" | "trial" | "free_or_trial";

type PopupFormState = {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  audience: PopupAudience;
  startAtLocal: string;
  endAtLocal: string;
  showAfterDays: string;
  frequencyDays: string;
  maxImpressions: string;
  priority: string;
};

const emptyForm: PopupFormState = {
  key: "",
  title: "",
  body: "",
  enabled: true,
  audience: "all",
  startAtLocal: "",
  endAtLocal: "",
  showAfterDays: "",
  frequencyDays: "",
  maxImpressions: "",
  priority: "",
};

function toDatetimeLocal(ms?: number): string {
  if (ms === undefined) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseOptionalInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseOptionalDatetimeLocal(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const ms = new Date(trimmed).getTime();
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

function audienceLabel(audience: PopupAudience) {
  if (audience === "all") return "Todos";
  if (audience === "free") return "Gratis";
  if (audience === "trial") return "Trial";
  return "Gratis o Trial";
}

function scheduleLabel(startAt?: number, endAt?: number) {
  if (startAt === undefined && endAt === undefined) return "Siempre";
  const start = startAt ? new Date(startAt).toLocaleString() : "(sin inicio)";
  const end = endAt ? new Date(endAt).toLocaleString() : "(sin fin)";
  return `${start} → ${end}`;
}

export default function AdminPopupsPage() {
  const popups = useQuery(api.functions.popups.listPopupsAdmin, {});
  const createPopup = useMutation(api.functions.popups.createPopupAdmin);
  const updatePopup = useMutation(api.functions.popups.updatePopupAdmin);
  const setEnabled = useMutation(api.functions.popups.setPopupEnabledAdmin);
  const deletePopup = useMutation(api.functions.popups.deletePopupAdmin);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PopupFormState>(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [editForm, setEditForm] = useState<PopupFormState>(emptyForm);

  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const selectedPopup = useMemo(() => {
    if (!popups || !editingId) return null;
    return popups.find((p: any) => p._id === editingId) ?? null;
  }, [popups, editingId]);

  const openEdit = (popup: any) => {
    setEditingId(popup._id);
    setEditForm({
      key: popup.key ?? "",
      title: popup.title ?? "",
      body: popup.body ?? "",
      enabled: !!popup.enabled,
      audience: (popup.audience ?? "all") as PopupAudience,
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

  const submitCreate = async () => {
    if (!createForm.key.trim()) {
      toast.error("El campo ‘Key’ es obligatorio");
      return;
    }
    if (!createForm.title.trim()) {
      toast.error("El campo ‘Título’ es obligatorio");
      return;
    }
    if (!createForm.body.trim()) {
      toast.error("El campo ‘Mensaje’ es obligatorio");
      return;
    }

    const startAt = parseOptionalDatetimeLocal(createForm.startAtLocal);
    const endAt = parseOptionalDatetimeLocal(createForm.endAtLocal);
    if (startAt !== undefined && endAt !== undefined && startAt > endAt) {
      toast.error("La fecha de inicio no puede ser posterior al fin");
      return;
    }

    try {
      await createPopup({
        key: createForm.key,
        title: createForm.title,
        body: createForm.body,
        enabled: createForm.enabled,
        audience: createForm.audience,
        ...(startAt !== undefined ? { startAt } : {}),
        ...(endAt !== undefined ? { endAt } : {}),
        ...(parseOptionalInt(createForm.showAfterDays) !== undefined
          ? { showAfterDays: parseOptionalInt(createForm.showAfterDays) }
          : {}),
        ...(parseOptionalInt(createForm.frequencyDays) !== undefined
          ? { frequencyDays: parseOptionalInt(createForm.frequencyDays) }
          : {}),
        ...(parseOptionalInt(createForm.maxImpressions) !== undefined
          ? { maxImpressions: parseOptionalInt(createForm.maxImpressions) }
          : {}),
        ...(parseOptionalInt(createForm.priority) !== undefined
          ? { priority: parseOptionalInt(createForm.priority) }
          : {}),
      });
      toast.success("Pop-up creado");
      setCreateForm(emptyForm);
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear el pop-up");
    }
  };

  const submitEdit = async () => {
    if (!editingId) return;
    if (!editForm.key.trim()) {
      toast.error("El campo ‘Key’ es obligatorio");
      return;
    }
    if (!editForm.title.trim()) {
      toast.error("El campo ‘Título’ es obligatorio");
      return;
    }
    if (!editForm.body.trim()) {
      toast.error("El campo ‘Mensaje’ es obligatorio");
      return;
    }

    const startAt = parseOptionalDatetimeLocal(editForm.startAtLocal);
    const endAt = parseOptionalDatetimeLocal(editForm.endAtLocal);
    if (startAt !== undefined && endAt !== undefined && startAt > endAt) {
      toast.error("La fecha de inicio no puede ser posterior al fin");
      return;
    }

    try {
      await updatePopup({
        popupId: editingId,
        key: editForm.key,
        title: editForm.title,
        body: editForm.body,
        enabled: editForm.enabled,
        audience: editForm.audience,
        ...(startAt !== undefined ? { startAt } : {}),
        ...(endAt !== undefined ? { endAt } : {}),
        ...(parseOptionalInt(editForm.showAfterDays) !== undefined
          ? { showAfterDays: parseOptionalInt(editForm.showAfterDays) }
          : {}),
        ...(parseOptionalInt(editForm.frequencyDays) !== undefined
          ? { frequencyDays: parseOptionalInt(editForm.frequencyDays) }
          : {}),
        ...(parseOptionalInt(editForm.maxImpressions) !== undefined
          ? { maxImpressions: parseOptionalInt(editForm.maxImpressions) }
          : {}),
        ...(parseOptionalInt(editForm.priority) !== undefined
          ? { priority: parseOptionalInt(editForm.priority) }
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

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateForm(emptyForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear pop-up
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear pop-up</DialogTitle>
                <DialogDescription>
                  Usá un mensaje claro y corto. Esto aparece dentro de la app.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-key">Key</Label>
                  <Input
                    id="create-key"
                    placeholder="blackfriday-2025"
                    value={createForm.key}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, key: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador estable (no usar espacios).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-audience">Audiencia</Label>
                  <Select
                    value={createForm.audience}
                    onValueChange={(v) =>
                      setCreateForm((p) => ({ ...p, audience: v as any }))
                    }
                  >
                    <SelectTrigger id="create-audience">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="free">Gratis</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="free_or_trial">
                        Gratis o Trial
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-title">Título</Label>
                  <Input
                    id="create-title"
                    placeholder="Novedad: invitá a tu equipo"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-body">Mensaje</Label>
                  <Textarea
                    id="create-body"
                    placeholder="Sumá colaboradores para organizar casos y documentos."
                    value={createForm.body}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, body: e.target.value }))
                    }
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-start">Inicio (opcional)</Label>
                  <Input
                    id="create-start"
                    type="datetime-local"
                    value={createForm.startAtLocal}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        startAtLocal: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-end">Fin (opcional)</Label>
                  <Input
                    id="create-end"
                    type="datetime-local"
                    value={createForm.endAtLocal}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        endAtLocal: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-show-after">
                    Mostrar después de (días)
                  </Label>
                  <Input
                    id="create-show-after"
                    inputMode="numeric"
                    placeholder="Ej: 2"
                    value={createForm.showAfterDays}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        showAfterDays: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Vacío = se puede mostrar desde el día 1.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-frequency">Frecuencia (días)</Label>
                  <Input
                    id="create-frequency"
                    inputMode="numeric"
                    placeholder="Ej: 7"
                    value={createForm.frequencyDays}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        frequencyDays: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Vacío = se puede repetir sin espera.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-max">Máx. impresiones</Label>
                  <Input
                    id="create-max"
                    inputMode="numeric"
                    placeholder="Ej: 3"
                    value={createForm.maxImpressions}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        maxImpressions: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Vacío = sin límite.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-priority">Prioridad</Label>
                  <Input
                    id="create-priority"
                    inputMode="numeric"
                    placeholder="Ej: 10"
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        priority: e.target.value,
                      }))
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
                    checked={createForm.enabled}
                    onCheckedChange={(v) =>
                      setCreateForm((p) => ({ ...p, enabled: v }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submitCreate}>Crear</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Consejos: usá “Audiencia” para segmentar (Gratis/Trial) y
            “Frecuencia” para no molestar al usuario.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Estado</TableHead>
                <TableHead>Contenido</TableHead>
                <TableHead className="w-40">Audiencia</TableHead>
                <TableHead className="w-[220px]">Vigencia</TableHead>
                <TableHead className="w-[220px]">Reglas</TableHead>
                <TableHead className="w-[110px]">Prioridad</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {popups === undefined ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center justify-center py-10">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Cargando…
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : popups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-10 text-center">
                      <p className="font-medium">No hay pop-ups todavía</p>
                      <p className="text-sm text-muted-foreground">
                        Creá el primero con el botón “Crear pop-up”.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                popups.map((p: any) => (
                  <TableRow key={String(p._id)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!p.enabled}
                          disabled={!!busyIds[String(p._id)]}
                          onCheckedChange={(v) => onToggleEnabled(p._id, v)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{p.title}</p>
                          <Badge variant="secondary">{p.key}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {p.body}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {audienceLabel(p.audience as PopupAudience)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {scheduleLabel(p.startAt, p.endAt)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">
                            Después de:
                          </span>{" "}
                          {p.showAfterDays === undefined
                            ? "—"
                            : `${p.showAfterDays}d`}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Frecuencia:
                          </span>{" "}
                          {p.frequencyDays === undefined
                            ? "—"
                            : `${p.frequencyDays}d`}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Máx.:</span>{" "}
                          {p.maxImpressions === undefined
                            ? "—"
                            : p.maxImpressions}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{p.priority ?? 0}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!!busyIds[String(p._id)]}
                          onClick={() => {
                            const ok = window.confirm(
                              "¿Eliminar este pop-up? Esta acción no se puede deshacer.",
                            );
                            if (!ok) return;
                            void confirmDelete(p._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) setEditingId(null);
          }}
        >
          <DialogContent className="max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar pop-up</DialogTitle>
              <DialogDescription>
                {selectedPopup ? (
                  <span>
                    Editando{" "}
                    <span className="font-medium">{selectedPopup.key}</span>
                  </span>
                ) : (
                  ""
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-key">Key</Label>
                <Input
                  id="edit-key"
                  value={editForm.key}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, key: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-audience">Audiencia</Label>
                <Select
                  value={editForm.audience}
                  onValueChange={(v) =>
                    setEditForm((p) => ({ ...p, audience: v as any }))
                  }
                >
                  <SelectTrigger id="edit-audience">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="free">Gratis</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="free_or_trial">
                      Gratis o Trial
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, title: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-body">Mensaje</Label>
                <Textarea
                  id="edit-body"
                  value={editForm.body}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, body: e.target.value }))
                  }
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-start">Inicio</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  value={editForm.startAtLocal}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      startAtLocal: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-end">Fin</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  value={editForm.endAtLocal}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      endAtLocal: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-show-after">
                  Mostrar después de (días)
                </Label>
                <Input
                  id="edit-show-after"
                  inputMode="numeric"
                  value={editForm.showAfterDays}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      showAfterDays: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-frequency">Frecuencia (días)</Label>
                <Input
                  id="edit-frequency"
                  inputMode="numeric"
                  value={editForm.frequencyDays}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      frequencyDays: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-max">Máx. impresiones</Label>
                <Input
                  id="edit-max"
                  inputMode="numeric"
                  value={editForm.maxImpressions}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      maxImpressions: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-priority">Prioridad</Label>
                <Input
                  id="edit-priority"
                  inputMode="numeric"
                  value={editForm.priority}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, priority: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Vacío = no modifica.
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
                  checked={editForm.enabled}
                  onCheckedChange={(v) =>
                    setEditForm((p) => ({ ...p, enabled: v }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={submitEdit}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAdminsOrg>
  );
}
