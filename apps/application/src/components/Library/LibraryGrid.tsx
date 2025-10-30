import {
  useQuery,
  useMutation,
  useAction,
  usePaginatedQuery,
} from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LibraryScope, SortOption, ViewMode } from "@/pages/LibraryPage";
import { FolderCard } from "./FolderCard";
import { DocumentCard } from "./DocumentCard";
import { useState, useEffect } from "react";
import { EditFolderDialog } from "./EditFolderDialog";
import { EditDocumentDialog } from "./EditDocumentDialog";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, DropResult } from "react-beautiful-dnd";

interface LibraryGridProps {
  activeScope: LibraryScope;
  currentFolderId: Id<"libraryFolders"> | undefined;
  searchQuery: string;
  typeFilter: string | undefined;
  sortBy: SortOption;
  viewMode: ViewMode;
  onFolderClick: (folderId: Id<"libraryFolders">) => void;
}

export function LibraryGrid({
  activeScope,
  currentFolderId,
  searchQuery,
  typeFilter,
  sortBy,
  viewMode,
  onFolderClick,
}: LibraryGridProps) {
  const [editingFolder, setEditingFolder] =
    useState<Doc<"libraryFolders"> | null>(null);
  const [editingDocument, setEditingDocument] =
    useState<Doc<"libraryDocuments"> | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Fetch folders - userId is handled server-side via auth
  const folders = useQuery(
    api.functions.libraryFolders.getLibraryFolders,
    activeScope.type === "personal"
      ? { parentFolderId: currentFolderId }
      : { teamId: activeScope.teamId, parentFolderId: currentFolderId },
  );

  // Fetch documents with pagination - userId is handled server-side via auth
  const {
    results: documents,
    status: documentsStatus,
    loadMore,
    isLoading: isLoadingDocuments,
  } = usePaginatedQuery(
    api.functions.libraryDocument.getLibraryDocuments,
    activeScope.type === "personal"
      ? { folderId: currentFolderId }
      : { teamId: activeScope.teamId, folderId: currentFolderId },
    { initialNumItems: 50 },
  );

  const deleteFolder = useMutation(
    api.functions.libraryFolders.deleteLibraryFolder,
  );
  const deleteDocument = useMutation(
    api.functions.libraryDocument.deleteLibraryDocument,
  );
  const getDocumentUrl = useAction(
    api.functions.libraryDocument.getLibraryDocumentUrl,
  );
  const moveDocument = useMutation(
    api.functions.libraryDocument.moveLibraryDocument,
  );

  // Mark as ready after initial render to allow droppables to register
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset ready state when folder changes
  useEffect(() => {
    setIsReady(false);
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, [currentFolderId]);

  // Drag and Drop handlers
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
    if (!destination || type !== "LIBRARY_DOCUMENT") return;

    // Only act when moving across different lists (folders/root)
    if (destination.droppableId === source.droppableId) return;

    const newFolderId =
      destination.droppableId === "root"
        ? undefined
        : (destination.droppableId as unknown as Id<"libraryFolders">);

    try {
      await moveDocument({
        documentId: draggableId as unknown as Id<"libraryDocuments">,
        newFolderId,
      });

      toast.success("Documento movido exitosamente");
    } catch (err) {
      console.error("Error moving document:", err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo mover el documento",
      );
    }
  };

  // Filter and sort
  const filteredFolders = (folders || []).filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const droppableId = (currentFolderId ?? "root") as string;

  const filteredDocuments = (documents || [])
    .filter((doc) => {
      // Filter by folder: when currentFolderId is undefined, only show docs without folderId
      // when currentFolderId is set, only show docs with that folderId
      const matchesFolder = currentFolderId
        ? doc.folderId === currentFolderId
        : !doc.folderId;

      const matchesSearch = doc.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType = typeFilter
        ? doc.mimeType.startsWith(typeFilter) ||
          doc.mimeType.includes(typeFilter)
        : true;
      return matchesFolder && matchesSearch && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title);
        case "size":
          return b.fileSize - a.fileSize;
        case "creationDate":
          return b._creationTime - a._creationTime;
        case "lastModified":
        default:
          return b._creationTime - a._creationTime;
      }
    });

  const handleDeleteFolder = async (folderId: Id<"libraryFolders">) => {
    try {
      await deleteFolder({ folderId });
      toast.success("Carpeta eliminada exitosamente");
    } catch (error: any) {
      toast.error(error.message || "No se pudo eliminar la carpeta");
    }
  };

  const handleDeleteDocument = async (documentId: Id<"libraryDocuments">) => {
    try {
      await deleteDocument({ documentId });
      toast.success("Documento eliminado exitosamente");
    } catch (error: any) {
      toast.error(error.message || "No se pudo eliminar el documento");
    }
  };

  const handleDownloadDocument = async (documentId: Id<"libraryDocuments">) => {
    try {
      const url = await getDocumentUrl({ documentId });
      window.open(url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el documento");
    }
  };

  // Get folder document counts
  const getFolderDocumentCount = (folderId: Id<"libraryFolders">) => {
    const count = (documents || []).filter(
      (doc) => doc.folderId === folderId,
    ).length;
    return count;
  };

  const totalItems = filteredFolders.length + filteredDocuments.length;

  if (viewMode === "list") {
    return (
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalItems} {totalItems === 1 ? "elemento" : "elementos"}
            </p>
          </div>

          <Droppable
            droppableId={droppableId}
            type="LIBRARY_DOCUMENT"
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
                className={`space-y-2 rounded-lg transition-colors ${
                  dropSnapshot.isDraggingOver
                    ? "bg-blue-50/70 border-2 border-blue-300 border-dashed p-2"
                    : ""
                }`}
              >
                {dropSnapshot.isDraggingOver && (
                  <div className="px-2 py-2 text-sm text-blue-700 text-center">
                    Suelta aquí para mover a esta ubicación
                  </div>
                )}

                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    documentCount={getFolderDocumentCount(folder._id)}
                    onClick={onFolderClick}
                    onEdit={setEditingFolder}
                    onDelete={handleDeleteFolder}
                    viewMode={viewMode}
                  />
                ))}

                {filteredDocuments.map((doc, index) => (
                  <DocumentCard
                    key={doc._id}
                    document={doc}
                    onEdit={setEditingDocument}
                    onDelete={handleDeleteDocument}
                    onDownload={handleDownloadDocument}
                    viewMode={viewMode}
                    index={index}
                    isDragDisabled={!isReady}
                  />
                ))}

                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>

          {documentsStatus === "CanLoadMore" && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => loadMore(50)}
                variant="outline"
                disabled={isLoadingDocuments}
              >
                {isLoadingDocuments ? "Cargando..." : "Cargar más documentos"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          <EditFolderDialog
            folder={editingFolder}
            open={!!editingFolder}
            onOpenChange={(open: boolean) => !open && setEditingFolder(null)}
          />

          <EditDocumentDialog
            document={editingDocument}
            open={!!editingDocument}
            onOpenChange={(open: boolean) => !open && setEditingDocument(null)}
          />
        </div>
      </DragDropContext>
    );
  }

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalItems} {totalItems === 1 ? "elemento" : "elementos"}
          </p>
        </div>

        <Droppable
          droppableId={droppableId}
          type="LIBRARY_DOCUMENT"
          isDropDisabled={false}
          isCombineEnabled={false}
          ignoreContainerClipping={false}
          direction="horizontal"
          mode="standard"
        >
          {(dropProvided, dropSnapshot) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className={`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 rounded-lg transition-colors ${
                dropSnapshot.isDraggingOver
                  ? "bg-blue-50/70 border-2 border-blue-300 border-dashed p-4"
                  : ""
              }`}
            >
              {dropSnapshot.isDraggingOver && (
                <div className="col-span-full px-2 py-2 text-sm text-blue-700 text-center">
                  Suelta aquí para mover a esta ubicación
                </div>
              )}

              {filteredFolders.map((folder) => (
                <FolderCard
                  key={folder._id}
                  folder={folder}
                  documentCount={getFolderDocumentCount(folder._id)}
                  onClick={onFolderClick}
                  onEdit={setEditingFolder}
                  onDelete={handleDeleteFolder}
                  viewMode={viewMode}
                />
              ))}

              {filteredDocuments.map((doc, index) => (
                <DocumentCard
                  key={doc._id}
                  document={doc}
                  onEdit={setEditingDocument}
                  onDelete={handleDeleteDocument}
                  onDownload={handleDownloadDocument}
                  viewMode={viewMode}
                  index={index}
                  isDragDisabled={!isReady}
                />
              ))}

              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>

        {totalItems === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay documentos ni carpetas
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Comienza subiendo un archivo o creando una carpeta
            </p>
          </div>
        )}

        {documentsStatus === "CanLoadMore" && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => loadMore(50)}
              variant="outline"
              disabled={isLoadingDocuments}
            >
              {isLoadingDocuments ? "Cargando..." : "Cargar más documentos"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        <EditFolderDialog
          folder={editingFolder}
          open={!!editingFolder}
          onOpenChange={(open: boolean) => !open && setEditingFolder(null)}
        />

        <EditDocumentDialog
          document={editingDocument}
          open={!!editingDocument}
          onOpenChange={(open: boolean) => !open && setEditingDocument(null)}
        />
      </div>
    </DragDropContext>
  );
}
