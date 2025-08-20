import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { IfCan } from "@/components/Permissions";
import { PERMISSIONS } from "@/permissions/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ChevronRight,
  Plus,
  Folder,
  Archive,
  MoreHorizontal,
  Pencil,
  FileText,
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
}: {
  caseId: Id<"cases">;
  parentFolderId: Id<"folders"> | undefined;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
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

  if (folders === undefined) {
    return (
      <div className="ml-6 text-[11px] text-muted-foreground">Cargando…</div>
    );
  }

  return (
    <div className="ml-2">
      {/* Documents at this level */}
      {documents && documents.length > 0 && (
        <div className="ml-4 mb-1">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-50"
            >
              <FileText size={14} className="text-gray-700 flex-shrink-0" />
              <span className="text-[12px] truncate" title={doc.title}>
                {doc.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Subfolders */}
      {folders &&
        folders.length === 0 &&
        (!documents || documents.length === 0) && (
          <div className="ml-6 text-[11px] text-muted-foreground">
            No hay elementos
          </div>
        )}

      {folders.map((folder) => (
        <FolderItem
          key={folder._id}
          folder={folder}
          caseId={caseId}
          currentFolderId={currentFolderId}
          onFolderChange={onFolderChange}
          pathIds={pathIds}
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
}: {
  folder: FolderType;
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  onFolderChange: (id: Id<"folders"> | undefined) => void;
  pathIds: Id<"folders">[];
}) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const newChildRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateFolder = useMutation(api.functions.folders.updateFolder);
  const archiveFolder = useMutation(api.functions.folders.archiveFolder);
  const createFolder = useMutation(api.functions.folders.createFolder);
  const generateUploadUrl = useAction(
    api.functions.documents.generateUploadUrl,
  );
  const createDocument = useMutation(api.functions.documents.createDocument);

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
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((m) => !m);
              }}
              aria-label="Nueva subcarpeta"
            >
              <Plus size={14} className="text-gray-600" />
            </Button>
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
        <div
          className="absolute right-2 top-7 z-10 w-36 rounded-md border bg-white shadow-md text-xs"
          data-folder-menu
          onClick={(e) => e.stopPropagation()}
        >
          {/* Creation options */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
            onClick={() => {
              setMenuOpen(false);
              setOpen(true);
              setIsCreatingChild(true);
            }}
          >
            <Plus size={12} /> Nueva carpeta
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
            onClick={() => {
              setMenuOpen(false);
              fileInputRef.current?.click();
            }}
          >
            <Plus size={12} /> Nuevo documento
          </button>
          <div className="my-1 border-t" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
            onClick={() => {
              setMenuOpen(false);
              setIsEditing(true);
            }}
          >
            <Pencil size={12} /> Renombrar
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left text-red-600"
            onClick={handleArchive}
          >
            <Archive size={12} /> Archivar
          </button>
        </div>
      )}
      {/* Hidden file input for "Nuevo documento" */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            // 1) Get signed URL for upload
            const signed = await generateUploadUrl({
              caseId,
              originalFileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
            } as any);
            // 2) Upload file to GCS
            const putResp = await fetch(signed.url, {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
              },
              body: file,
            });
            if (!putResp.ok)
              throw new Error(`Upload failed: ${putResp.status}`);
            // 3) Create document in DB with folderId
            await createDocument({
              title: file.name,
              caseId,
              folderId: folder._id as Id<"folders">,
              gcsBucket: signed.bucket,
              gcsObject: signed.object,
              originalFileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
            } as any);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
            setOpen(true);
          } catch (err) {
            console.error("Error uploading document:", err);
            alert(
              err instanceof Error
                ? err.message
                : "No se pudo subir el documento",
            );
          }
        }}
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
