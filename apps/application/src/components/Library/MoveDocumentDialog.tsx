import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, ChevronRight, Home, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MoveDocumentDialogProps {
  document: Doc<"libraryDocuments"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId?: Id<"libraryFolders">;
}

export function MoveDocumentDialog({
  document,
  open,
  onOpenChange,
  currentFolderId,
}: MoveDocumentDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<
    Id<"libraryFolders"> | undefined
  >(currentFolderId);
  const [currentViewFolderId, setCurrentViewFolderId] = useState<
    Id<"libraryFolders"> | undefined
  >(undefined);

  const moveDocument = useMutation(
    api.functions.libraryDocument.moveLibraryDocument,
  );

  // Get Root folder
  const rootFolder = useQuery(
    api.functions.libraryFolders.getLibraryRootFolder,
    document?.teamId ? { teamId: document.teamId } : {},
  );

  // Get folders in current view
  const folders = useQuery(
    api.functions.libraryFolders.getLibraryFolders,
    document
      ? document.teamId
        ? {
            teamId: document.teamId,
            parentFolderId: currentViewFolderId || rootFolder?._id,
          }
        : { parentFolderId: currentViewFolderId || rootFolder?._id }
      : "skip",
  );

  // Get current folder for breadcrumb
  const currentViewFolder = useQuery(
    api.functions.libraryFolders.getLibraryFolder,
    currentViewFolderId ? { folderId: currentViewFolderId } : "skip",
  );

  // Get breadcrumb path
  const folderPath = useQuery(
    api.functions.libraryFolders.getLibraryFolderPath,
    currentViewFolderId ? { folderId: currentViewFolderId } : "skip",
  );

  // Reset view when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentViewFolderId(undefined);
      setSelectedFolderId(currentFolderId);
    }
  }, [open, currentFolderId]);

  const handleMove = async () => {
    if (!document || !rootFolder) return;

    // If selectedFolderId is undefined or equals rootFolder._id, move to Root
    const targetFolderId =
      selectedFolderId === rootFolder._id ? rootFolder._id : selectedFolderId;

    try {
      await moveDocument({
        documentId: document._id,
        newFolderId: targetFolderId,
      });

      toast.success("Documento movido exitosamente");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo mover el documento");
    }
  };

  const handleFolderClick = (folderId: Id<"libraryFolders">) => {
    setCurrentViewFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId?: Id<"libraryFolders">) => {
    setCurrentViewFolderId(folderId);
  };

  // Filter out Root folder and current document's folder from the list
  const filteredFolders = (folders || []).filter((folder) => {
    if (rootFolder && folder._id === rootFolder._id) return false;
    if (folder._id === currentFolderId) return false;
    return true;
  });

  const isRootView =
    !currentViewFolderId || currentViewFolderId === rootFolder?._id;
  const canSelectCurrentLocation = currentViewFolderId !== currentFolderId;

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg">Mover documento</DialogTitle>
          <DialogDescription className="text-sm mt-1.5">
            Seleccioná la carpeta destino para "{document.title}"
          </DialogDescription>
        </DialogHeader>

        {/* Current location indicator */}
        <div className="px-6 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Ubicación actual:
            </span>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {isRootView ? (
                <>
                  <Home className="h-3.5 w-3.5 text-blue-500" />
                  <span>Mi biblioteca</span>
                </>
              ) : (
                <>
                  <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                  <span>{currentViewFolder?.name || "Cargando..."}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Folders list */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-0.5">
            {filteredFolders.length > 0 ? (
              filteredFolders.map((folder) => (
                <button
                  key={folder._id}
                  onClick={() => handleFolderClick(folder._id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-left hover:bg-muted/60 group border border-transparent hover:border-border"
                >
                  <Folder className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="flex-1 truncate text-sm font-medium">
                    {folder.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No hay subcarpetas
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta carpeta está vacía
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <button
              onClick={() => handleBreadcrumbClick(undefined)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="h-3 w-3" />
              <span>Mi biblioteca</span>
            </button>
            {folderPath && folderPath.length > 0 && (
              <>
                {folderPath
                  .filter((f) => f._id !== rootFolder?._id)
                  .map((folder) => (
                    <div key={folder._id} className="flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      <button
                        onClick={() => handleBreadcrumbClick(folder._id)}
                        className="hover:text-foreground transition-colors truncate max-w-[100px]"
                      >
                        {folder.name}
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>

          {/* Action buttons */}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-w-[100px]"
            >
              Cancelar
            </Button>
            {canSelectCurrentLocation && (
              <Button
                onClick={async () => {
                  if (!document || !rootFolder) return;
                  const targetFolderId = currentViewFolderId || rootFolder._id;
                  try {
                    await moveDocument({
                      documentId: document._id,
                      newFolderId: targetFolderId,
                    });
                    toast.success("Documento movido exitosamente");
                    onOpenChange(false);
                  } catch (error: any) {
                    toast.error(
                      error.message || "No se pudo mover el documento",
                    );
                  }
                }}
                className="min-w-[100px]"
              >
                Mover
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
