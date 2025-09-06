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
import { Droppable, Draggable } from "react-beautiful-dnd";
import { toast } from "sonner";
import {
  ChevronRight,
  Folder,
  MoreHorizontal,
  FileText,
  Trash2,
  Loader2,
  GripVertical,
} from "lucide-react";
import FolderActionsMenu from "./FolderActionsMenu";
import NewDocumentInput, { NewDocumentInputHandle } from "./NewDocumentInput";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useHighlight } from "@/context/HighlightContext";
import { useLayout } from "@/context/LayoutContext";

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

  // DnD handlers + prevent global horizontal scroll while dragging
  const moveDocument = useMutation(api.functions.documents.moveDocument);
  // Optimistic: hide doc from its source list immediately during move
  const [movingFrom, setMovingFrom] = useState<Record<string, string>>({});
  const handleDragStart = () => {
    try {
      document.body.classList.add("overflow-x-hidden");
    } catch {}
  };
  const handleDragEnd = async (result: DropResult) => {
    try {
      document.body.classList.remove("overflow-x-hidden");
    } catch {}
    const { destination, source, draggableId, type } = result;
    if (!destination || type !== "DOCUMENT") return;
    // Only act when moving across different lists (folders/root)
    if (destination.droppableId === source.droppableId) return;

    const newFolderId =
      destination.droppableId === "root"
        ? undefined
        : (destination.droppableId as unknown as Id<"folders">);
    try {
      // Optimistically hide from source list
      setMovingFrom((prev) => ({
        ...prev,
        [draggableId]: source.droppableId,
      }));
      await moveDocument({
        documentId: draggableId as unknown as Id<"documents">,
        newFolderId,
      } as any);
    } catch (err) {
      console.error("Error moving document:", err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo mover el documento",
      );
    } finally {
      setMovingFrom((prev) => {
        const cp = { ...prev };
        delete cp[draggableId];
        return cp;
      });
    }
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
    </DragDropContext>
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
  const droppableId = (parentFolderId ?? "root") as string;
  const visibleDocuments = (documents ?? []).filter(
    (doc) => movingFrom[(doc._id as unknown as string) ?? ""] !== droppableId,
  );

  return (
    <div className="ml-2 overflow-x-hidden">
      {isLoadingFolders && (
        <div className="ml-2 text-[11px] text-muted-foreground">Cargando…</div>
      )}
      {/* Documents at this level */}
      {documents && (
        <Droppable
          droppableId={droppableId}
          type="DOCUMENT"
          isDropDisabled={false}
          isCombineEnabled={false}
          ignoreContainerClipping={false}
          direction="vertical"
          mode="standard"
        >
          {(dropProvided, dropSnapshot) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className={`pl-4 mb-2 rounded transition-colors w-full max-w-full box-border border border-transparent overflow-x-hidden ${
                dropSnapshot.isDraggingOver
                  ? "bg-blue-50/70 border-blue-300 border-dashed"
                  : ""
              }`}
            >
              {dropSnapshot.isDraggingOver && (
                <div className="px-2 py-1 text-[10px] text-blue-700">
                  Suelta aquí para mover al nivel actual
                </div>
              )}
              {visibleDocuments.map((doc, index) => (
                <Draggable
                  draggableId={doc._id as unknown as string}
                  index={index}
                  key={doc._id as any}
                  isDragDisabled={false}
                >
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-gray-50 transition-colors w-full max-w-full min-w-0 box-border border border-transparent overflow-hidden ${
                        dragSnapshot.isDragging
                          ? "bg-blue-100/80 border border-blue-300 opacity-80 shadow-sm"
                          : ""
                      }`}
                    >
                      <span
                        className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
                        aria-label="Arrastrar documento"
                        title="Arrastrar documento"
                        {...dragProvided.dragHandleProps}
                      >
                        <GripVertical size={12} />
                      </span>
                      <Link
                        to={
                          basePath ? `${basePath}/documentos/${doc._id}` : `#`
                        }
                        className="flex items-center gap-1 min-w-0 flex-1"
                        onClick={(e) => {
                          if (!basePath) e.preventDefault();
                          if (dragSnapshot.isDragging) e.preventDefault();
                        }}
                      >
                        <FileText
                          size={14}
                          className="text-gray-700 flex-shrink-0"
                        />
                        <span
                          className="text-[12px] truncate"
                          title={doc.title}
                        >
                          {doc.title}
                        </span>
                      </Link>
                      <IfCan
                        permission={PERMISSIONS.DOC_DELETE}
                        fallback={null}
                      >
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
                            <Loader2
                              size={12}
                              className="text-gray-500 animate-spin"
                            />
                          ) : (
                            <Trash2 size={12} className="text-gray-500" />
                          )}
                        </Button>
                      </IfCan>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
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
  const [menuOpen, setMenuOpen] = useState(false);
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
      setMenuOpen(false);
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

  return (
    <div className="relative">
      {open ? (
        <div
          className={`flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 ${
            currentFolderId === (folder._id as Id<"folders">)
              ? "bg-blue-50"
              : ""
          } ${highlightedFolder === folder._id ? "animate-pulse-once " : ""}`}
        >
          <div className="flex items-center gap-1 min-w-0">
            <button
              className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-800"
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
      ) : (
        <Droppable
          droppableId={folder._id as unknown as string}
          type="DOCUMENT"
          isDropDisabled={false}
          isCombineEnabled={false}
          ignoreContainerClipping={false}
          direction="vertical"
          mode="standard"
        >
          {(dropProvided, dropSnapshot) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
              <div
                className={`flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 ${
                  currentFolderId === (folder._id as Id<"folders">)
                    ? "bg-blue-50"
                    : ""
                } ${
                  highlightedFolder === folder._id ? "animate-pulse-once " : ""
                } ${
                  dropSnapshot.isDraggingOver
                    ? "bg-blue-50/70 border border-blue-300 border-dashed"
                    : "border border-transparent"
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    className="h-5 w-5 flex items-center justify-center text-gray-600 hover:text-gray-800"
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
                      className="truncate text-left px-1 hover:text-foreground"
                      title={folder.name}
                      onClick={() =>
                        onFolderChange(folder._id as Id<"folders">)
                      }
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
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      )}
      {menuOpen && (
        <FolderActionsMenu
          onCreateFolder={() => {
            setMenuOpen(false);
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
