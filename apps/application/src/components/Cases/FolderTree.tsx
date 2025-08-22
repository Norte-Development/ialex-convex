import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { IfCan } from "@/components/Permissions";
import { PERMISSIONS } from "@/permissions/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  Folder,
  MoreHorizontal,
  FileText,
  Trash2,
  Loader2,
} from "lucide-react";
import FolderActionsMenu from "./FolderActionsMenu";
import NewDocumentInput, { NewDocumentInputHandle } from "./NewDocumentInput";

type Props = {
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderChange: (folderId: Id<"folders"> | undefined) => void;
  className?: string;
  basePath?: string; // for linking to documents
};

export function FolderTree({
  caseId,
  currentFolderId,
  onFolderChange,
  className,
  basePath,
}: Props) {
  const path = useQuery(
    api.functions.folders.getFolderPath,
    currentFolderId ? { folderId: currentFolderId } : "skip",
  ) as FolderType[] | undefined;
  const pathIds = (path ?? []).map((f) => f._id as Id<"folders">);

  return (
    <div className={className}>
      {/* Tree starting at root */}
      <FolderList
        caseId={caseId}
        parentFolderId={undefined}
        currentFolderId={currentFolderId}
        onFolderChange={onFolderChange}
        pathIds={pathIds}
        basePath={basePath}
      />
    </div>
  );
}

export default FolderTree;

function FolderList({
  caseId,
  parentFolderId,
  currentFolderId,
  onFolderChange,
  pathIds,
  basePath,
}: {
  caseId: Id<"cases">;
  parentFolderId: Id<"folders"> | undefined;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
  basePath?: string;
}) {
  const args: any = parentFolderId ? { caseId, parentFolderId } : { caseId };
  const folders = useQuery(api.functions.folders.getFoldersForCase, args) as
    | FolderType[]
    | undefined;

  // Also load documents for this level (root when parentFolderId is undefined)
  const documents = useQuery(api.functions.documents.getDocumentsInFolder, {
    caseId,
    folderId: parentFolderId,
  } as any) as { _id: Id<"documents">; title: string }[] | undefined;
  const isLoadingFolders = folders === undefined;

  const deleteDocument = useMutation(api.functions.documents.deleteDocument);
  const [deletingId, setDeletingId] = useState<Id<"documents"> | null>(null);
  const handleDelete = async (id: Id<"documents">) => {
    try {
      setDeletingId(id);
      await deleteDocument({ documentId: id } as any);
    } finally {
      setDeletingId(null);
    }
  };
  return (
    <div className="ml-2">
      {isLoadingFolders && (
        <div className="ml-6 text-[11px] text-muted-foreground">Cargando…</div>
      )}
      {/* Documents at this level */}
      {documents && documents.length > 0 && (
        <div className="ml-4 mb-1">
          {documents.map((doc) => (
            <div
              key={doc._id as any}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-gray-50"
            >
              <Link
                to={basePath ? `${basePath}/documentos/${doc._id}` : `#`}
                className="flex items-center gap-1 min-w-0"
                draggable={true}
                data-document-drag="true"
                onDragStart={(e) => {
                  // Set drag data to identify this as an internal document drag
                  e.dataTransfer.setData(
                    "application/x-ialex-document",
                    doc._id,
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={(e) => {
                  if (!basePath) e.preventDefault();
                }}
              >
                <FileText size={14} className="text-gray-700 flex-shrink-0" />
                <span className="text-[12px] truncate" title={doc.title}>
                  {doc.title}
                </span>
              </Link>
              <IfCan permission={PERMISSIONS.DOC_DELETE} fallback={null}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200 flex-shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(doc._id as Id<"documents">);
                  }}
                  disabled={deletingId === (doc._id as Id<"documents">)}
                  title="Eliminar documento"
                >
                  {deletingId === (doc._id as Id<"documents">) ? (
                    <Loader2 size={12} className="text-gray-500 animate-spin" />
                  ) : (
                    <Trash2 size={12} className="text-gray-500" />
                  )}
                </Button>
              </IfCan>
            </div>
          ))}
        </div>
      )}

      {/* Subfolders */}
      {!isLoadingFolders &&
        folders &&
        folders.length === 0 &&
        (!documents || documents.length === 0) && (
          <div className="ml-6 text-[11px] text-muted-foreground">
            No hay elementos
          </div>
        )}

      {(folders ?? []).map((folder) => (
        <FolderItem
          key={folder._id}
          folder={folder}
          caseId={caseId}
          currentFolderId={currentFolderId}
          onFolderChange={onFolderChange}
          pathIds={pathIds}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

function FolderItem({
  folder,
  caseId,
  currentFolderId,
  onFolderChange,
  pathIds,
  basePath,
}: {
  folder: FolderType;
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
  basePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const newChildRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<NewDocumentInputHandle | null>(null);

  const updateFolder = useMutation(api.functions.folders.updateFolder);
  const archiveFolder = useMutation(api.functions.folders.archiveFolder);
  const createFolder = useMutation(api.functions.folders.createFolder);
  // Upload and document creation handled by NewDocumentInput

  useEffect(() => {
    if (pathIds.includes(folder._id as Id<"folders">)) {
      setOpen(true);
    }
  }, [pathIds, folder._id]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest("[data-folder-menu]") ||
        target.closest("[data-folder-menu-trigger]")
      )
        return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const submitRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setIsEditing(false);
      setName(folder.name);
      return;
    }
    try {
      await updateFolder({
        folderId: folder._id as Id<"folders">,
        name: trimmed,
      } as any);
      setIsEditing(false);
    } catch (err) {
      console.error("Error renaming folder:", err);
      alert(
        err instanceof Error ? err.message : "No se pudo renombrar la carpeta",
      );
      setIsEditing(false);
      setName(folder.name);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveFolder({ folderId: folder._id as Id<"folders"> } as any);
      setMenuOpen(false);
    } catch (err) {
      console.error("Error archiving folder:", err);
      alert(
        err instanceof Error ? err.message : "No se pudo archivar la carpeta",
      );
    }
  };

  useEffect(() => {
    if (isCreatingChild) {
      const t = setTimeout(() => newChildRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isCreatingChild]);

  const submitCreateChild = async () => {
    const name = (newChildName || "").trim() || "Nueva Carpeta";
    try {
      await createFolder({
        name,
        caseId,
        parentFolderId: folder._id as Id<"folders">,
      } as any);
      setIsCreatingChild(false);
      setNewChildName("");
      setOpen(true);
    } catch (err) {
      console.error("Error creating folder:", err);
      alert(err instanceof Error ? err.message : "No se pudo crear la carpeta");
    }
  };

  return (
    <div className="relative">
      <div
        className={`flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 ${
          currentFolderId === (folder._id as Id<"folders">) ? "bg-blue-50" : ""
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-800"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Contraer" : "Expandir"}
          >
            <ChevronRight
              size={14}
              className={
                open
                  ? "transform rotate-90 transition-transform"
                  : "transform transition-transform"
              }
            />
          </button>
          <Folder size={16} className="text-black flex-shrink-0" />
          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setName(folder.name);
                }
              }}
              onBlur={submitRename}
              className="h-4 text-xs placeholder:text-xs"
              autoFocus
            />
          ) : (
            <button
              className="truncate text-left px-1 hover:text-foreground"
              title={folder.name}
              onClick={() => onFolderChange(folder._id as Id<"folders">)}
            >
              {folder.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {folder.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[40%] mr-2">
              {folder.description}
            </span>
          )}
          <IfCan permission={PERMISSIONS.DOC_WRITE} fallback={null}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-200"
              data-folder-menu-trigger
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((m) => !m);
              }}
              aria-label="Acciones de carpeta"
            >
              <MoreHorizontal size={14} className="text-gray-600" />
            </Button>
          </IfCan>
        </div>
      </div>
      {menuOpen && (
        <FolderActionsMenu
          onCreateFolder={() => {
            setMenuOpen(false);
            setOpen(true);
            setIsCreatingChild(true);
          }}
          onCreateDocument={() => {
            setMenuOpen(false);
            fileInputRef.current?.open();
          }}
          onRename={() => {
            setMenuOpen(false);
            setIsEditing(true);
          }}
          onArchive={handleArchive}
        />
      )}
      <NewDocumentInput
        ref={fileInputRef}
        caseId={caseId}
        folderId={folder._id as Id<"folders">}
        onSuccess={() => setOpen(true)}
        onError={(err) =>
          alert(
            err instanceof Error
              ? err.message
              : "No se pudo subir el documento",
          )
        }
      />
      {open && (
        <div className="ml-4">
          {/* Show documents belonging to this folder above its subfolders */}
          <FolderList
            caseId={caseId}
            parentFolderId={folder._id as Id<"folders">}
            currentFolderId={currentFolderId}
            onFolderChange={onFolderChange}
            pathIds={pathIds}
            basePath={basePath}
          />
          {/* Nested subfolders are rendered by the FolderList above */}
          {isCreatingChild && (
            <div className="flex items-center gap-2 p-1">
              <Input
                ref={newChildRef}
                placeholder="Nombre de la carpeta"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreateChild();
                  else if (e.key === "Escape") {
                    setIsCreatingChild(false);
                    setNewChildName("");
                  }
                }}
                className="h-4 text-xs placeholder:text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
