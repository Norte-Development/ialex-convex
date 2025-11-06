import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Folder,
  FileText,
  Trash2,
  Loader2,
  GripVertical,
} from "lucide-react";
import FolderActionsMenu from "./FolderActionsMenu";
import NewDocumentInput, { NewDocumentInputHandle } from "./NewDocumentInput";
import { useHighlight } from "@/context/HighlightContext";
import { useLayout } from "@/context/LayoutContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { PermissionToasts } from "@/lib/permissionToasts";
import {
  dropTargetForElements,
  monitorForElements,
  draggable,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

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

  // PDD: Global drag monitoring
  const moveDocument = useMutation(api.functions.documents.moveDocument);
  const [movingFrom, setMovingFrom] = useState<Record<string, string>>({});

  useEffect(() => {
    return monitorForElements({
      onDragStart: () => {
        try {
          document.body.classList.add("overflow-x-hidden");
        } catch {}
      },
      onDrop: async (args) => {
        try {
          document.body.classList.remove("overflow-x-hidden");
        } catch {}

        const { source, location } = args;
        if (source.data.type !== "DOCUMENT") return;

        const dropTargetData = location.current.dropTargets[0]?.data;
        if (!dropTargetData) return;

        const sourceDocumentId = source.data.documentId as Id<"documents">;
        const sourceFolderId = source.data.folderId as Id<"folders"> | undefined;
        const targetFolderId = dropTargetData.folderId as Id<"folders"> | undefined;

        // Don't move if dropping in the same folder
        if (sourceFolderId === targetFolderId) return;

        try {
          setMovingFrom((prev) => ({
            ...prev,
            [sourceDocumentId]: sourceFolderId ?? "root",
          }));
          await moveDocument({
            documentId: sourceDocumentId,
            newFolderId: targetFolderId,
          } as any);
          toast.success("Documento movido exitosamente");
        } catch (err) {
          console.error("Error moving document:", err);
          toast.error(
            err instanceof Error ? err.message : "No se pudo mover el documento",
          );
        } finally {
          setMovingFrom((prev) => {
            const cp = { ...prev };
            delete cp[sourceDocumentId];
            return cp;
          });
        }
      },
    });
  }, [moveDocument]);

  return (
    <div className={`overflow-x-hidden ${className ?? ""}`}>
      {/* Tree starting at root */}
      <FolderList
        caseId={caseId}
        parentFolderId={undefined}
        currentFolderId={currentFolderId}
        onFolderChange={onFolderChange}
        pathIds={pathIds}
        basePath={basePath}
        movingFrom={movingFrom}
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
  movingFrom,
}: {
  caseId: Id<"cases">;
  parentFolderId: Id<"folders"> | undefined;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
  basePath?: string;
  movingFrom: Record<string, string>;
}) {
  // Use new non-paginated queries for better performance
  const folders = useQuery(api.functions.folders.getAllFoldersForCase, {
    caseId,
    parentFolderId,
  }) as FolderType[] | undefined;

  // Also load documents for this level (root when parentFolderId is undefined)
  const documents = useQuery(api.functions.documents.getAllDocumentsInFolder, {
    caseId,
    folderId: parentFolderId,
  }) as { _id: Id<"documents">; title: string }[] | undefined;
  
  const isLoadingFolders = folders === undefined;

  const deleteDocument = useMutation(api.functions.documents.deleteDocument);
  const [deletingId, setDeletingId] = useState<Id<"documents"> | null>(null);
  const handleDelete = async (id: Id<"documents">) => {
    // Check permissions first
    if (!can.docs.delete) {
      PermissionToasts.documents.delete();
      return;
    }

    try {
      setDeletingId(id);
      await deleteDocument({ documentId: id } as any);
      toast.success("Documento eliminado exitosamente");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };
  const droppableId = (parentFolderId ?? "root") as string;
  const visibleDocuments = (documents ?? []).filter(
    (doc) => movingFrom[(doc._id as unknown as string) ?? ""] !== droppableId,
  );

  const { can } = usePermissions();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Setup drop zone for documents
  useEffect(() => {
    if (!dropZoneRef.current) return;

    return dropTargetForElements({
      element: dropZoneRef.current,
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
      getData: () => ({
        folderId: parentFolderId,
        type: "DOCUMENT",
      }),
    });
  }, [parentFolderId]);

  return (
    <div className="ml-2 overflow-x-hidden">
      {isLoadingFolders && (
        <div className="ml-2 text-[11px] text-muted-foreground">Cargando…</div>
      )}
      {/* Documents at this level */}
      {documents && (
        <div
          ref={dropZoneRef}
          className={`pl-4 mb-2 rounded transition-colors w-full max-w-full box-border border border-transparent overflow-x-hidden ${
            isDraggingOver
              ? "bg-blue-50/70 border-blue-300 border-dashed"
              : ""
          }`}
        >
          {isDraggingOver && (
            <div className="px-2 py-1 text-[10px] text-blue-700">
              Suelta aquí para mover al nivel actual
            </div>
          )}
          {visibleDocuments.map((doc, index) => (
            <DocumentItem
              key={doc._id}
              doc={doc}
              index={index}
              parentFolderId={parentFolderId}
              basePath={basePath}
              can={can}
              deletingId={deletingId}
              handleDelete={handleDelete}
            />
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
          movingFrom={movingFrom}
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
  movingFrom,
}: {
  folder: FolderType;
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
  basePath?: string;
  movingFrom: Record<string, string>;
}) {
  const { isFolderOpen, setFolderOpen, toggleFolder } = useLayout();
  const open = isFolderOpen(folder._id as Id<"folders">);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const newChildRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<NewDocumentInputHandle | null>(null);
  const { highlightedFolder, setHighlightedFolder } = useHighlight();

  const updateFolder = useMutation(api.functions.folders.updateFolder);
  const archiveFolder = useMutation(api.functions.folders.archiveFolder);
  const createFolder = useMutation(api.functions.folders.createFolder);

  useEffect(() => {
    // Permite la expansion de las carpetas hijas al cargar la pagina
    if (pathIds.includes(folder._id as Id<"folders">)) {
      setFolderOpen(folder._id as Id<"folders">, true);
    }
  }, [pathIds, folder._id, setFolderOpen]);

  useEffect(() => {
    if (isCreatingChild) {
      const t = setTimeout(() => newChildRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isCreatingChild]);

  const handleToggleOpen = () => {
    toggleFolder(folder._id as Id<"folders">);
  };

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
      toast.error(
        err instanceof Error ? err.message : "No se pudo renombrar la carpeta",
      );
      setIsEditing(false);
      setName(folder.name);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveFolder({ folderId: folder._id as Id<"folders"> } as any);
    } catch (err) {
      console.error("Error archiving folder:", err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo archivar la carpeta",
      );
    }
  };

  const submitCreateChild = async () => {
    const name = (newChildName || "").trim() || "Nueva Carpeta";
    try {
      const newFolderId = await createFolder({
        name,
        caseId,
        parentFolderId: folder._id as Id<"folders">,
      } as any);
      setHighlightedFolder(newFolderId);
      setIsCreatingChild(false);
      setNewChildName("");
      setFolderOpen(folder._id as Id<"folders">, true);
    } catch (err) {
      console.error("Error creating folder:", err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear la carpeta",
      );
    }
  };

  const { can } = usePermissions();
  const folderDropRef = useRef<HTMLDivElement>(null);
  const [isDraggingOverFolder, setIsDraggingOverFolder] = useState(false);

  // Setup drop target for this folder (when closed)
  useEffect(() => {
    if (!folderDropRef.current || open) return;

    return dropTargetForElements({
      element: folderDropRef.current,
      onDragEnter: () => setIsDraggingOverFolder(true),
      onDragLeave: () => setIsDraggingOverFolder(false),
      onDrop: () => setIsDraggingOverFolder(false),
      getData: () => ({
        folderId: folder._id,
        type: "DOCUMENT",
      }),
    });
  }, [folder._id, open]);

  return (
    <div className="relative">
      {open ? (
        <div
          className={`flex items-center justify-between gap-1 px-2 py-1 rounded hover:bg-gray-50 min-w-0 ${
            currentFolderId === (folder._id as Id<"folders">)
              ? "bg-blue-50"
              : ""
          } ${highlightedFolder === folder._id ? "animate-pulse-once " : ""}`}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-800 flex-shrink-0"
              onClick={handleToggleOpen}
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
                className="truncate text-left px-1 hover:text-foreground min-w-0"
                title={folder.name}
                onClick={() => onFolderChange(folder._id as Id<"folders">)}
              >
                {folder.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {folder.description && (
              <span className="text-xs text-muted-foreground truncate max-w-[40%] mr-2">
                {folder.description}
              </span>
            )}
            {can.docs.write && (
              <FolderActionsMenu
                onCreateFolder={() => {
                  setIsCreatingChild(true);
                }}
                onCreateDocument={() => {
                  fileInputRef.current?.open();
                }}
                onRename={() => {
                  setIsEditing(true);
                }}
                onArchive={handleArchive}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          ref={folderDropRef}
          className={`flex items-center justify-between gap-1 px-2 py-1 rounded hover:bg-gray-50 min-w-0 ${
            currentFolderId === (folder._id as Id<"folders">)
              ? "bg-blue-50"
              : ""
          } ${
            highlightedFolder === folder._id ? "animate-pulse-once " : ""
          } ${
            isDraggingOverFolder
              ? "bg-blue-50/70 border border-blue-300 border-dashed"
              : "border border-transparent"
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-800 flex-shrink-0"
              onClick={handleToggleOpen}
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
                className="truncate text-left px-1 hover:text-foreground min-w-0"
                title={folder.name}
                onClick={() =>
                  onFolderChange(folder._id as Id<"folders">)
                }
              >
                {folder.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {folder.description && (
              <span className="text-xs text-muted-foreground truncate max-w-[40%] mr-2">
                {folder.description}
              </span>
            )}
            {can.docs.write && (
              <FolderActionsMenu
                onCreateFolder={() => {
                  setIsCreatingChild(true);
                }}
                onCreateDocument={() => {
                  fileInputRef.current?.open();
                }}
                onRename={() => {
                  setIsEditing(true);
                }}
                onArchive={handleArchive}
              />
            )}
          </div>
        </div>
      )}
      <NewDocumentInput
        ref={fileInputRef}
        caseId={caseId}
        folderId={folder._id as Id<"folders">}
        onSuccess={() => setFolderOpen(folder._id as Id<"folders">, true)}
        onError={(err) =>
          toast.error(
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
            movingFrom={movingFrom}
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

interface DocumentItemProps {
  doc: { _id: Id<"documents">; title: string };
  index: number;
  parentFolderId: Id<"folders"> | undefined;
  basePath?: string;
  can: any;
  deletingId: Id<"documents"> | null;
  handleDelete: (id: Id<"documents">) => void;
}

function DocumentItem({
  doc,
  index,
  parentFolderId,
  basePath,
  can,
  deletingId,
  handleDelete,
}: DocumentItemProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLSpanElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Setup draggable for this document
  useEffect(() => {
    if (!dragRef.current) return;

    return draggable({
      element: dragRef.current,
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
      getInitialData: () => ({
        documentId: doc._id,
        index,
        type: "DOCUMENT",
        folderId: parentFolderId,
      }),
      dragHandle: dragHandleRef.current ?? undefined,
    });
  }, [doc._id, index, parentFolderId]);

  return (
    <div
      ref={dragRef}
      className={`flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors w-full max-w-full min-w-0 box-border border border-transparent overflow-hidden ${
        isDragging
          ? "bg-blue-100/80 border border-blue-300 opacity-80 shadow-sm"
          : ""
      }`}
    >
      <span
        ref={dragHandleRef}
        className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Arrastrar documento"
        title="Arrastrar documento"
      >
        <GripVertical size={12} />
      </span>
      <Link
        to={basePath ? `${basePath}/documentos/${doc._id}` : `#`}
        className="flex items-center gap-1 min-w-0 flex-1"
        onClick={(e) => {
          if (!basePath) e.preventDefault();
          if (isDragging) e.preventDefault();
        }}
      >
        <FileText size={14} className="text-gray-700 flex-shrink-0" />
        <span className="text-[12px] truncate" title={doc.title}>
          {doc.title}
        </span>
      </Link>
      {can.docs.delete && (
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
      )}
    </div>
  );
}
