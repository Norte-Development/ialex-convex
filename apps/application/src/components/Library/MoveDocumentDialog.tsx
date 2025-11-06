import { useState } from "react";
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
import { Folder, ChevronRight, Home } from "lucide-react";
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

  const moveDocument = useMutation(
    api.functions.libraryDocument.moveLibraryDocument,
  );

  // Get Root folder
  const rootFolder = useQuery(
    api.functions.libraryFolders.getLibraryRootFolder,
    document?.teamId ? { teamId: document.teamId } : {},
  );

  // Get all available destinations
  const destinations = useQuery(
    api.functions.libraryFolders.listMoveDestinationsForLibraryDocument,
    document ? { documentId: document._id } : "skip",
  );

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

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Mover documento</DialogTitle>
          <DialogDescription>
            Seleccioná la carpeta donde querés mover "{document.title}"
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-1">
            {/* Mi biblioteca (Root folder) option */}
            {rootFolder && (
              <button
                onClick={() => setSelectedFolderId(rootFolder._id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${
                  selectedFolderId === rootFolder._id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="flex-1">Mi biblioteca</span>
                {selectedFolderId === rootFolder._id && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </button>
            )}

            {/* Folder list - Filter out Root folder if it appears in destinations */}
            {destinations
              ?.filter((dest) => dest.folderId !== rootFolder?._id)
              .map((dest) => (
                <button
                  key={dest.folderId}
                  onClick={() =>
                    setSelectedFolderId(dest.folderId as Id<"libraryFolders">)
                  }
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${
                    selectedFolderId === dest.folderId
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  }`}
                  style={{ paddingLeft: `${12 + dest.depth * 20}px` }}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{dest.name}</span>
                  {selectedFolderId === dest.folderId && (
                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}

            {(!destinations || destinations.length === 0) && !rootFolder && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay carpetas disponibles
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={selectedFolderId === currentFolderId}
          >
            Mover acá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
