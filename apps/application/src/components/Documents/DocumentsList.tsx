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
  Folder,
  FileText,
  Download,
  Pencil,
  MoreVertical,
  ChevronUp,
  FolderOpen,
  Trash2,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DocumentItem = {
  _id: Id<"documents">;
  _creationTime: number;
  title: string;
  caseId: Id<"cases">;
  createdBy: Id<"users">;
  documentType?: string;
  mimeType: string;
  fileSize: number;
  lastEditedAt?: number;
  folderId?: Id<"folders">;
};

type FolderItem = {
  _id: Id<"folders">;
  _creationTime: number;
  name: string;
  caseId: Id<"cases">;
  createdBy: Id<"users">;
  description?: string;
  isArchived: boolean;
};

type DocumentsListProps = {
  documents: DocumentItem[] | undefined | null;
  folders: FolderItem[] | undefined | null;
  caseId?: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderClick?: (folderId: Id<"folders">) => void;
  breadcrumb?: React.ReactNode;
  onCreateFolder?: () => void;
  onCreateDocument?: () => void;
};

export default function DocumentsList({
  documents,
  folders,
  caseId,
  onFolderClick,
  breadcrumb,
  onCreateFolder,
  onCreateDocument,
}: DocumentsListProps) {
  const { can, hasAccessLevel } = usePermissions();
  const navigate = useNavigate();

  if (documents === undefined || folders === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando documentos...</p>
      </div>
    );
  }

  if (!can.docs.read) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          No tienes permisos para ver los documentos de este caso.
        </p>
      </div>
    );
  }

  const formatDate = (ts?: number) =>
    ts ? format(new Date(ts), "dd/MM/yyyy") : "-";

  const formatAgo = (ts?: number) =>
    ts
      ? formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es })
      : "-";

  const hasItems =
    (folders && folders.length > 0) || (documents && documents.length > 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Documentos</h1>
          <p className="text-gray-600">
            Lista de documentos y carpetas del caso
          </p>
        </div>
        <div className="flex gap-2">
          {can.docs.write && onCreateFolder && (
            <Button
              onClick={onCreateFolder}
              variant="outline"
              size="sm"
              className="bg-white border-tertiary text-tertiary border-1"
            >
              Nueva Carpeta
            </Button>
          )}
          {can.docs.write && onCreateDocument && (
            <Button onClick={onCreateDocument} size="sm">
              Subir Documento
            </Button>
          )}
        </div>
      </div>
      {breadcrumb && <div className="mb-4">{breadcrumb}</div>}

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border rounded-lg bg-gray-50/50">
          <div className="rounded-full bg-gray-100 p-6">
            <FolderOpen className="h-12 w-12 text-gray-400" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              No hay documentos todavía
            </p>
            <p className="text-sm text-gray-500 max-w-md">
              Puedes agregar nuevos documentos y crear carpetas para
              organizarlos.
            </p>
          </div>
        </div>
      ) : (
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
              <TableHead>Tipo</TableHead>
              <TableHead>Modificado</TableHead>
              {hasAccessLevel(ACCESS_LEVELS.ADMIN) && (
                <TableHead className="text-right w-24">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Render folders first */}
            {folders?.map((folder) => (
              <FolderRow
                key={folder._id}
                folder={folder}
                onOpen={() => onFolderClick?.(folder._id)}
                formatDate={formatDate}
                showActions={hasAccessLevel(ACCESS_LEVELS.ADMIN)}
              />
            ))}
            {/* Then render documents */}
            {documents?.map((document) => (
              <DocumentRow
                key={document._id}
                document={document}
                onOpen={() =>
                  navigate(`/caso/${caseId}/documentos/${document._id}`)
                }
                formatDate={formatDate}
                formatAgo={formatAgo}
                showActions={hasAccessLevel(ACCESS_LEVELS.ADMIN)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function FolderRow({
  folder,
  onOpen,
  formatDate,
  showActions,
}: {
  folder: FolderItem;
  onOpen: () => void;
  formatDate: (ts?: number) => string;
  showActions: boolean;
}) {
  const user = useQuery(api.functions.users.getUserById, {
    userId: folder.createdBy,
  });

  const archiveFolder = useMutation(api.functions.folders.archiveFolder);

  const handleArchive = async () => {
    const confirmed = window.confirm(
      "¿Archivar esta carpeta y su contenido? Podrás restaurarla después.",
    );
    if (!confirmed) return;
    try {
      await archiveFolder({ folderId: folder._id });
      toast.success("Carpeta archivada exitosamente");
    } catch (err) {
      console.error("Error archiving folder", err);
      toast.error("No se pudo archivar la carpeta");
    }
  };

  return (
    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={onOpen}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox aria-label="Seleccionar" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-amber-500" />
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{folder.name}</span>
            {folder.description && (
              <span className="text-xs text-gray-500">
                {folder.description}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>{user?.name ?? "-"}</TableCell>
      <TableCell>{formatDate(folder._creationTime)}</TableCell>
      <TableCell>
        <span className="text-gray-500">Carpeta</span>
      </TableCell>
      <TableCell>-</TableCell>
      {showActions && (
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2 text-gray-500">
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
                  Archivar carpeta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpen}>Abrir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function DocumentRow({
  document,
  onOpen,
  formatDate,
  formatAgo,
  showActions,
}: {
  document: DocumentItem;
  onOpen: () => void;
  formatDate: (ts?: number) => string;
  formatAgo: (ts?: number) => string;
  showActions: boolean;
}) {
  const user = useQuery(api.functions.users.getUserById, {
    userId: document.createdBy,
  });

  const deleteDocument = useMutation(api.functions.documents.deleteDocument);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "¿Eliminar este documento permanentemente? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    try {
      await deleteDocument({ documentId: document._id });
      toast.success("Documento eliminado exitosamente");
    } catch (err) {
      console.error("Error deleting document", err);
      toast.error("No se pudo eliminar el documento");
    }
  };

  const getDocumentTypeLabel = (type?: string) => {
    const types: Record<string, string> = {
      contract: "Contrato",
      evidence: "Evidencia",
      correspondence: "Correspondencia",
      legal_brief: "Escrito Legal",
      court_filing: "Presentación Judicial",
      other: "Otro",
    };
    return type ? types[type] || type : "Documento";
  };

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox aria-label="Seleccionar" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{document.title}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>{user?.name ?? "-"}</TableCell>
      <TableCell>{formatDate(document._creationTime)}</TableCell>
      <TableCell>{getDocumentTypeLabel(document.documentType)}</TableCell>
      <TableCell>
        {formatAgo(document.lastEditedAt || document._creationTime)}
      </TableCell>
      {showActions && (
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2 text-gray-500">
            <button
              type="button"
              className="p-1 hover:text-gray-900"
              aria-label="Descargar"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1 hover:text-gray-900"
              aria-label="Ver documento"
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
                <DropdownMenuItem onClick={handleDelete} variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Eliminar documento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpen}>
                  Ver documento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
