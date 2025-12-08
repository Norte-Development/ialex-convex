import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link2, Download, Pencil, MoreVertical, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EscritosLoadingState from "./EscritosLoadingState";
import EscritosEmptyState from "./EscritosEmptyState";
import { usePermissions } from "@/context/CasePermissionsContext";
import { ACCESS_LEVELS } from "@/permissions/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState } from "react";
import { exportToPdfReact } from "@/components/Editor/utils/exportPdfReact";
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { JSONContent } from "@tiptap/react";

// Interfaz para el snapshot que viene de Convex
interface SnapshotData {
  content?: string | JSONContent;
  snapshot?: {
    content?: string | JSONContent;
  };
}

export default function EscritosList({
  all_escritos,
  caseId,
}: {
  all_escritos: any[] | undefined | null;
  caseId?: Id<"cases">;
  templateId?: Id<"modelos">;
}) {
  const { can, hasAccessLevel } = usePermissions();
  const navigate = useNavigate();

  if (all_escritos === undefined) return <EscritosLoadingState />;
  if (all_escritos?.length === 0) return <EscritosEmptyState />;

  if (!can.escritos.read)
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No tienes permisos para ver los escritos de este caso.
        </p>
      </div>
    );

  const formatDate = (ts?: number) =>
    ts ? format(new Date(ts), "dd/MM/yyyy") : "-";

  const formatAgo = (ts?: number) =>
    ts
      ? formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es })
      : "-";

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Escritos</h1>
        <p className="text-gray-600">Lista de escritos del caso</p>
      </div>

      {/** Mostrar acciones solo para ADMIN */}
      {/** Determina si se renderiza la columna de acciones */}
      {/** Admin = ADVANCED+? No, estrictamente ADMIN según guía */}

      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox aria-label="Seleccionar todos" />
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Subido por</TableHead>
            <TableHead className="min-w-[140px]">
              <div className="inline-flex items-center gap-1">
                Creado el
                <ChevronUp className="h-3 w-3 text-gray-400" />
              </div>
            </TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Modificado</TableHead>
            {hasAccessLevel(ACCESS_LEVELS.ADMIN) && (
              <TableHead className="text-right w-24">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {all_escritos?.map((escrito) => (
            <EscritoRow
              key={escrito._id}
              escrito={escrito}
              onOpen={() => navigate(`/caso/${caseId}/escritos/${escrito._id}`)}
              formatDate={formatDate}
              formatAgo={formatAgo}
              showActions={hasAccessLevel(ACCESS_LEVELS.ADMIN)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EscritoRow({
  escrito,
  onOpen,
  formatDate,
  formatAgo,
  showActions,
}: {
  escrito: any;
  onOpen: () => void;
  formatDate: (ts?: number) => string;
  formatAgo: (ts?: number) => string;
  showActions: boolean;
}) {
  // Fetch uploader name
  const user = useQuery(api.functions.users.getUserById, {
    userId: escrito.createdBy,
  });

  // Fetch the prosemirror snapshot for PDF export
  const snapshot = useQuery(
    api.prosemirror.getSnapshot,
    escrito.prosemirrorId ? { id: escrito.prosemirrorId } : "skip",
  );

  const [isExporting, setIsExporting] = useState(false);

  // Mutations (admin-only actions are protected server-side too)
  const archiveEscrito = useMutation(api.functions.documents.archiveEscrito);

  const handleArchive = async () => {
    const confirmed = window.confirm(
      "¿Archivar este escrito? Podrás restaurarlo desde la vista de archivados.",
    );
    if (!confirmed) return;
    try {
      await archiveEscrito({ escritoId: escrito._id, isArchived: true });
    } catch (err) {
      console.error("Error archiving escrito", err);
      alert("No se pudo archivar el escrito.");
    }
  };

  const handleExportToPdf = async () => {
    setIsExporting(true);
    try {
      // Validate snapshot exists
      if (!snapshot) {
        toast.error("No hay contenido para exportar");
        return;
      }

      // Tipado del snapshot usando la interfaz SnapshotData
      const snapshotData = snapshot as SnapshotData;

      // Parse content from snapshot (same pattern as fetchContent)
      let content;
      if (typeof snapshotData.content === "string") {
        content = JSON.parse(snapshotData.content);
      } else if (snapshotData.snapshot?.content) {
        if (typeof snapshotData.snapshot.content === "string") {
          content = JSON.parse(snapshotData.snapshot.content);
        } else {
          content = snapshotData.snapshot.content;
        }
      } else {
        toast.error("No hay contenido para exportar");
        return;
      }

      if (!content) {
        toast.error("No hay contenido para exportar");
        return;
      }

      await exportToPdfReact(content, {
        title: escrito.title,
        courtName: escrito.courtName,
        expedientNumber: escrito.expedientNumber,
        presentationDate: escrito.presentationDate,
      });

      toast.success("PDF descargado correctamente");
    } catch (error) {
      toast.error("Error al exportar el PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const statusLabel = escrito.status === "borrador" ? "Borrador" : "Publicado";
  const statusColor =
    escrito.status === "borrador" ? "bg-gray-300" : "bg-amber-400";

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox aria-label="Seleccionar" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{escrito.title}</span>
            {/* Optional tag badge placeholder */}
            {/* <Badge className="mt-1 w-fit" variant="secondary">Tag</Badge> */}
          </div>
        </div>
      </TableCell>
      <TableCell>{user?.name ?? "-"}</TableCell>
      <TableCell>{formatDate(escrito._creationTime)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusColor}`}
          />
          <span>{statusLabel}</span>
        </div>
      </TableCell>
      <TableCell>{formatAgo(escrito.lastEditedAt)}</TableCell>
      {showActions && (
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2 text-gray-500">
            <button
              type="button"
              className="p-1 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Descargar"
              onClick={handleExportToPdf}
              disabled={isExporting}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1 hover:text-gray-900"
              aria-label="Editar"
              onClick={onOpen}
            >
              <Pencil className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 hover:text-gray-900"
                  aria-label="Más acciones"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive}>
                  Archivar escrito
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpen}>Editar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
