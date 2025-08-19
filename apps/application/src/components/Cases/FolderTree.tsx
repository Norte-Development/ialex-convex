import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { IfCan } from "@/components/Permissions";
import { PERMISSIONS } from "@/permissions/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  FolderOpen,
  ChevronRight,
  Plus,
  Folder,
  Archive,
  MoreHorizontal,
  Pencil,
} from "lucide-react";

type Props = {
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderChange: (folderId: Id<"folders"> | undefined) => void;
  className?: string;
};

export function FolderTree({
  caseId,
  currentFolderId,
  onFolderChange,
  className,
}: Props) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<Id<"folders"> | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState<Id<"folders"> | null>(null);

  // Fetch folders for current level
  const folders = useQuery(api.functions.folders.getFoldersForCase, {
    caseId,
    parentFolderId: currentFolderId,
  }) as FolderType[] | undefined;

  // Breadcrumb for current folder
  const breadcrumb = useQuery(
    api.functions.folders.getFolderPath,
    currentFolderId ? { folderId: currentFolderId } : "skip",
  ) as FolderType[] | undefined;

  const createFolder = useMutation(api.functions.folders.createFolder);
  const updateFolder = useMutation(api.functions.folders.updateFolder);
  const archiveFolder = useMutation(api.functions.folders.archiveFolder);

  useEffect(() => {
    if (isCreatingFolder) {
      const t = setTimeout(() => newFolderInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isCreatingFolder]);

  const submitCreateFolder = async () => {
    const name = (newFolderName || "").trim() || "Nueva Carpeta";
    try {
      await createFolder({
        name,
        caseId,
        parentFolderId: currentFolderId,
      } as any);
      setNewFolderName("");
      setIsCreatingFolder(false);
    } catch (err) {
      console.error("Error creating folder:", err);
      alert(err instanceof Error ? err.message : "No se pudo crear la carpeta");
    }
  };

  const cancelEditing = () => {
    setEditingFolderId(null);
    setEditingName("");
  };

  const submitRename = async (folderId: Id<"folders">) => {
    const name = editingName.trim();
    if (!name) {
      cancelEditing();
      return;
    }
    try {
      await updateFolder({ folderId, name } as any);
      cancelEditing();
    } catch (err) {
      console.error("Error renaming folder:", err);
      alert(
        err instanceof Error ? err.message : "No se pudo renombrar la carpeta",
      );
    }
  };

  const handleArchive = async (folderId: Id<"folders">) => {
    try {
      await archiveFolder({ folderId } as any);
    } catch (err) {
      console.error("Error archiving folder:", err);
      alert(
        err instanceof Error ? err.message : "No se pudo archivar la carpeta",
      );
    }
  };

  return (
    <div className={className}>
      {/* Breadcrumb + Create */}
      <div className="flex items-center justify-between gap-1 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <button
            className={`flex items-center gap-1 hover:text-foreground ${!currentFolderId ? "text-foreground font-medium" : ""}`}
            onClick={() => onFolderChange(undefined)}
          >
            <FolderOpen size={14} /> Raíz
          </button>
          {breadcrumb && breadcrumb.length > 0 && (
            <>
              {breadcrumb.map((f, idx) => (
                <span key={f._id} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button
                    className={`hover:text-foreground ${idx === breadcrumb.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    onClick={() => onFolderChange(f._id)}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        <IfCan permission={PERMISSIONS.DOC_WRITE} fallback={null}>
          {!isCreatingFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0 hover:bg-gray-100"
              onClick={() => setIsCreatingFolder(true)}
            >
              <Plus size={14} />
            </Button>
          )}
        </IfCan>
      </div>

      {/* Inline new folder input */}
      {isCreatingFolder && (
        <div className="flex items-center gap-2 p-1">
          <Input
            ref={newFolderInputRef}
            placeholder="Nombre de la carpeta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitCreateFolder();
              } else if (e.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            className="h-4 text-xs placeholder:text-xs"
          />
        </div>
      )}

      {/* Folders List */}
      {folders && folders.length > 0 && (
        <div className="flex flex-col ">
          {folders.map((folder) => {
            const isEditing = editingFolderId === (folder._id as Id<"folders">);
            const isMenuOpen = menuOpenFor === (folder._id as Id<"folders">);
            return (
              <div
                key={folder._id}
                className="relative flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50"
              >
                <div
                  className="flex items-center gap-2 min-w-0 cursor-pointer"
                  onClick={() => {
                    if (isEditing) return;
                    onFolderChange(folder._id);
                  }}
                >
                  <Folder size={16} className="text-black flex-shrink-0" />
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          submitRename(folder._id as Id<"folders">);
                        if (e.key === "Escape") cancelEditing();
                      }}
                      onBlur={() => submitRename(folder._id as Id<"folders">)}
                      className="h-4 text-xs placeholder:text-xs"
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="truncate" title={folder.name}>
                      {folder.name}
                    </span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenFor(
                          isMenuOpen ? null : (folder._id as Id<"folders">),
                        );
                      }}
                      aria-label="Acciones de carpeta"
                    >
                      <MoreHorizontal size={14} className="text-gray-600" />
                    </Button>
                  </IfCan>
                </div>
                {isMenuOpen && (
                  <div
                    className="absolute right-2 top-8 z-10 w-32 rounded-md border bg-white shadow-md text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                      onClick={() => {
                        setMenuOpenFor(null);
                        setEditingFolderId(folder._id as Id<"folders">);
                        setEditingName(folder.name);
                      }}
                    >
                      <Pencil size={12} /> Renombrar
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left text-red-600"
                      onClick={() => {
                        setMenuOpenFor(null);
                        handleArchive(folder._id as Id<"folders">);
                      }}
                    >
                      <Archive size={12} /> Archivar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FolderTree;
