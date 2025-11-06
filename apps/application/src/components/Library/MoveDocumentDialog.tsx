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
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderRow } from "./MoveDocumentDialog/FolderRow";
import { BreadcrumbNavigation } from "./MoveDocumentDialog/BreadcrumbNavigation";
import { CurrentLocationIndicator } from "./MoveDocumentDialog/CurrentLocationIndicator";
import { EmptyFoldersState } from "./MoveDocumentDialog/EmptyFoldersState";

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

  // Get source folder (where the document currently is)
  const sourceFolder = useQuery(
    api.functions.libraryFolders.getLibraryFolder,
    currentFolderId ? { folderId: currentFolderId } : "skip",
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

  const handleFolderClick = (folderId: Id<"libraryFolders">) => {
    setCurrentViewFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId?: Id<"libraryFolders">) => {
    setCurrentViewFolderId(folderId);
  };

  const handleMoveToFolder = async (targetFolderId: Id<"libraryFolders">) => {
    if (!document || !rootFolder) return;

    // Get source folder name
    const sourceFolderName = currentFolderId
      ? currentFolderId === rootFolder._id
        ? "Mi biblioteca"
        : sourceFolder?.name || "carpeta actual"
      : "Mi biblioteca";

    // Get target folder
    const targetFolder = folders?.find((f) => f._id === targetFolderId);
    const targetFolderName = targetFolder?.name || "carpeta destino";

    try {
      await moveDocument({
        documentId: document._id,
        newFolderId: targetFolderId,
      });
      toast.success(`Movido de "${sourceFolderName}" a "${targetFolderName}"`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo mover el documento");
    }
  };

  const handleMoveToCurrentLocation = async () => {
    if (!document || !rootFolder) return;
    const targetFolderId = currentViewFolderId || rootFolder._id;

    // Get target folder name
    const targetFolderName = isRootView
      ? "Mi biblioteca"
      : currentViewFolder?.name || "carpeta seleccionada";

    try {
      await moveDocument({
        documentId: document._id,
        newFolderId: targetFolderId,
      });
      toast.success(`Movido a "${targetFolderName}"`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo mover el documento");
    }
  };

  // Filter out only Root folder (keep current folder to allow navigation to subfolders)
  const filteredFolders = (folders || []).filter((folder) => {
    if (rootFolder && folder._id === rootFolder._id) return false;
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
        <CurrentLocationIndicator
          isRootView={isRootView}
          currentViewFolder={currentViewFolder}
        />

        {/* Folders list */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-0.5">
            {filteredFolders.length > 0 ? (
              filteredFolders.map((folder) => (
                <FolderRow
                  key={folder._id}
                  folder={folder}
                  onNavigate={handleFolderClick}
                  onMove={handleMoveToFolder}
                  disableMove={folder._id === currentFolderId}
                />
              ))
            ) : (
              <EmptyFoldersState />
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20">
          {/* Breadcrumb navigation */}
          <BreadcrumbNavigation
            folderPath={folderPath}
            rootFolderId={rootFolder?._id}
            onNavigate={handleBreadcrumbClick}
          />

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
                onClick={handleMoveToCurrentLocation}
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
