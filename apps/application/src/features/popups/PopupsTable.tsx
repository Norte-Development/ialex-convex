import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { PopupAudience } from "./popupTypes";
import { audienceLabel, scheduleLabel } from "./popupUtils";
import { DeletePopupConfirmation } from "./DeletePopupConfirmation";

type PopupRow = {
  _id: any;
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  audience: PopupAudience;
  startAt?: number;
  endAt?: number;
  showAfterDays?: number;
  frequencyDays?: number;
  maxImpressions?: number;
  priority?: number;
};

type Props = {
  popups: PopupRow[] | undefined;
  busyIds: Record<string, boolean>;
  onToggleEnabled: (popupId: any, next: boolean) => void;
  onEdit: (popup: PopupRow) => void;
  onDelete: (popupId: any) => void;
};

export function PopupsTable({
  popups,
  busyIds,
  onToggleEnabled,
  onEdit,
  onDelete,
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<any>(null);
  const pendingRow = useMemo(() => {
    if (!popups || pendingDeleteId == null) return null;
    return (
      popups.find((p) => String(p._id) === String(pendingDeleteId)) ?? null
    );
  }, [popups, pendingDeleteId]);

  const confirmDisabled = pendingDeleteId
    ? !!busyIds[String(pendingDeleteId)]
    : false;

  return (
    <>
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
                      <p className="text-sm text-muted-foreground">Cargando…</p>
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
              popups.map((p) => (
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
                        onClick={() => onEdit(p)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!!busyIds[String(p._id)]}
                        onClick={() => setPendingDeleteId(p._id)}
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

      <DeletePopupConfirmation
        open={pendingDeleteId != null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
        title={
          pendingRow?.title
            ? `Eliminar “${pendingRow.title}”`
            : "Eliminar pop-up"
        }
        description={
          pendingRow?.key
            ? `Vas a eliminar el pop-up con key “${pendingRow.key}”. Esta acción no se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        confirmDisabled={confirmDisabled}
        onConfirm={async () => {
          if (pendingDeleteId == null) return;
          await onDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </>
  );
}
