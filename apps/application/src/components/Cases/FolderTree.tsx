import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { IfCan } from "@/components/Permissions";
import { PERMISSIONS } from "@/permissions/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { FolderOpen, ChevronRight, Plus, Folder } from "lucide-react";

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
        <div className="flex flex-col gap-1 mt-1">
          {folders.map((folder) => (
            <button
              key={folder._id}
              onClick={() => onFolderChange(folder._id)}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Folder size={16} className="text-black flex-shrink-0" />
                <span className="truncate">{folder.name}</span>
              </span>
              {folder.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                  {folder.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FolderTree;
