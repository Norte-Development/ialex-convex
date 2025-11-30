import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Link2,
  Pencil,
  MoreVertical,
  ChevronUp,
  FileText,
  FileDown,
  Save,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EscritosLoadingState from "./EscritosLoadingState";
import EscritosEmptyState from "./EscritosEmptyState";
import { usePermissions } from "@/context/CasePermissionsContext";
import { ACCESS_LEVELS } from "@/permissions/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useQuery, useMutation, useConvex } from "convex/react";
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
import { exportToWord } from "@/components/Editor/utils/exportWord";
import { exportElementToPdf } from "@/components/Editor/utils/exportPdf";
import { generateHTML } from "@tiptap/html";
import { extensions } from "@/components/Editor/extensions";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [showBulkArchiveDialog, setShowBulkArchiveDialog] = useState(false);
  const archiveEscrito = useMutation(api.functions.documents.archiveEscrito);

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

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {

    if (!all_escritos) return;
    if (checked) {
      setSelectedIds(new Set(all_escritos.map((e) => e._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkArchive = async () => {
    if (!all_escritos) return;
    setShowBulkArchiveDialog(true);
  };

  const confirmBulkArchive = async () => {
    setShowBulkArchiveDialog(false);
    setIsArchiving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          archiveEscrito({ escritoId: id as Id<"escritos">, isArchived: true }),
        ),
      );
      toast.success(`${selectedIds.size} escrito${selectedIds.size > 1 ? "s archivados" : " archivado"} correctamente`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error archiving escritos:", error);
      toast.error("Error al archivar los escritos");
    } finally {
      setIsArchiving(false);
    }
  };

  const allSelected = (all_escritos?.length ?? 0) > 0 && selectedIds.size === (all_escritos?.length ?? 0);
  const someSelected = selectedIds.size > 0 && selectedIds.size < (all_escritos?.length ?? 0);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Escritos</h1>
        <p className="text-gray-600">Lista de escritos del caso</p>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">
              {selectedIds.size} escrito{selectedIds.size > 1 ? "s" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkArchive}
              disabled={isArchiving}
            >
              {isArchiving ? "Archivando..." : "Archivar seleccionados"}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden container for PDF generation - positioned off-screen but visible for html2canvas */}
      <div
        id="pdf-export-container"
        className="fixed -left-[9999px] top-0 w-[210mm] bg-white p-[10mm]"
        style={{ zIndex: -1 }}
      />

      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox 
                aria-label="Seleccionar todos"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
              />
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
              isSelected={selectedIds.has(escrito._id)}
              onToggleSelect={() => handleToggleSelect(escrito._id)}
            />
          ))}
        </TableBody>
      </Table>

      {/* Bulk Archive Confirmation Dialog */}
      <AlertDialog open={showBulkArchiveDialog} onOpenChange={setShowBulkArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar escritos seleccionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Se archivarán {selectedIds.size} escrito{selectedIds.size > 1 ? "s" : ""}. Podrás restaurarlos desde la vista de archivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkArchive}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EscritoRow({
  escrito,
  onOpen,
  formatDate,
  formatAgo,
  showActions,
  isSelected,
  onToggleSelect,
}: {
  escrito: any;
  onOpen: () => void;
  formatDate: (ts?: number) => string;
  formatAgo: (ts?: number) => string;
  showActions: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const convex = useConvex();
  const [isExporting, setIsExporting] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Fetch uploader name
  const user = useQuery(api.functions.users.getUserById, {
    userId: escrito.createdBy,
  });

  // Mutations (admin-only actions are protected server-side too)
  const archiveEscrito = useMutation(api.functions.documents.archiveEscrito);

  const handleArchive = () => {
    setShowArchiveDialog(true);
  };

  const confirmArchive = async () => {
    setShowArchiveDialog(false);
    try {
      await archiveEscrito({ escritoId: escrito._id, isArchived: true });
      toast.success("Escrito archivado correctamente");
    } catch (err) {
      console.error("Error archiving escrito", err);
      toast.error("No se pudo archivar el escrito.");
    }
  };

  const fetchContent = async () => {
    try {
      const snapshot = await convex.query(api.prosemirror.getSnapshot, {
        id: escrito.prosemirrorId,
      });

      if (!snapshot || !snapshot.content) {
        throw new Error("No content found");
      }
      
      return JSON.parse(snapshot.content);
    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Error al obtener el contenido del escrito");
      return null;
    }
  };

  const handleExportToWord = async () => {
    setIsExporting(true);
    try {
      const content = await fetchContent();
      if (!content) return;

      await exportToWord(content, {
        title: escrito.title,
        courtName: escrito.courtName,
        expedientNumber: escrito.expedientNumber,
        presentationDate: escrito.presentationDate,
      });
      toast.success("Documento Word descargado correctamente");
    } catch (error) {
      console.error("❌ Error al exportar:", error);
      toast.error("Error al exportar el documento");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToPdf = async () => {
    setIsExporting(true);
    try {
      const content = await fetchContent();
      if (!content) return;

      // Generate HTML from Tiptap JSON
      const html = generateHTML(content, extensions);
      
      // Remove xmlns attributes that can cause rendering issues
      const cleanHtml = html.replace(/\s*xmlns="[^"]*"/g, '');

      // Render into hidden container
      const container = document.getElementById("pdf-export-container");
      if (!container) {
        throw new Error("PDF container not found");
      }

      // Add some basic styling for the PDF content
      container.innerHTML = `
        <div class="legal-editor-content prose prose-lg max-w-none">
          ${cleanHtml}
        </div>
      `;

      // Wait a bit for DOM to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const filename = `${(escrito?.title || "escrito").replace(/\s+/g, "_")}.pdf`;
      await exportElementToPdf({
        element: container,
        filename,
        format: "a4",
        orientation: "p",
        marginMm: 10,
        scale: 2,
      });

      // Cleanup
      container.innerHTML = "";
      toast.success("PDF descargado correctamente");
    } catch (error) {
      console.error("❌ Error al exportar PDF:", error);
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
        <Checkbox 
          aria-label="Seleccionar"
          checked={isSelected}
          onCheckedChange={onToggleSelect}
        />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isExporting}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportToWord}>
                  <FileText className="h-4 w-4 mr-2" />
                  Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportToPdf}>
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar este escrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Podrás restaurarlo desde la vista de archivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
}
