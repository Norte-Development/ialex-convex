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
import { useState, useEffect, useRef } from "react";
import { EditFolderDialog } from "./EditFolderDialog";
import { EditDocumentDialog } from "./EditDocumentDialog";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { FileText, ChevronRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverParent, setIsDraggingOverParent] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const parentDropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch current folder to get parent info
  const currentFolder = useQuery(
    api.functions.libraryFolders.getLibraryFolder,
    currentFolderId ? { folderId: currentFolderId } : "skip",
  );


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

  // Setup PDD monitor for drag and drop
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
        if (source.data.type !== "LIBRARY_DOCUMENT") return;

        const dropTargetData = location.current.dropTargets[0]?.data;
        if (!dropTargetData) return;

        const sourceDocumentId = source.data.documentId as Id<"libraryDocuments">;
        const targetFolderId = dropTargetData.folderId as Id<"libraryFolders"> | undefined;

        // Don't move if dropping in the same folder
        if (source.data.currentFolderId === targetFolderId) return;

        try {
          await moveDocument({
            documentId: sourceDocumentId,
            newFolderId: targetFolderId,
          });

          toast.success("Documento movido exitosamente");
        } catch (err) {
          console.error("Error moving document:", err);
          toast.error(
            err instanceof Error ? err.message : "No se pudo mover el documento",
          );
        }
      },
    });
  }, [moveDocument]);

  // Setup drop zone for current folder
  useEffect(() => {
    if (!dropZoneRef.current) return;

    return dropTargetForElements({
      element: dropZoneRef.current,
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
      getData: () => ({
        folderId: currentFolderId,
        type: "LIBRARY_DOCUMENT_DROP_ZONE",
      }),
    });
  }, [currentFolderId]);

  // Setup drop zone for parent folder (if exists)
  useEffect(() => {
    if (!parentDropZoneRef.current || !currentFolder?.parentFolderId) return;

    return dropTargetForElements({
      element: parentDropZoneRef.current,
      onDragEnter: () => setIsDraggingOverParent(true),
      onDragLeave: () => setIsDraggingOverParent(false),
      onDrop: () => setIsDraggingOverParent(false),
      getData: () => ({
        folderId: currentFolder.parentFolderId,
        type: "LIBRARY_DOCUMENT_DROP_ZONE",
      }),
    });
  }, [currentFolder?.parentFolderId]);

  // Filter and sort
  const filteredFolders = (folders || []).filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalItems} {totalItems === 1 ? "elemento" : "elementos"}
          </p>
        </div>

        <div className="space-y-2">
          {/* Parent folder drop zone */}
          {currentFolder?.parentFolderId && (
            <div
              ref={parentDropZoneRef}
              className={`rounded-lg transition-all duration-200 flex items-center justify-center py-3 ${
                isDraggingOverParent
                  ? "bg-amber-50/80 border-2 border-amber-400 border-dashed shadow-sm"
                  : "border border-gray-200 bg-gray-50/50"
              }`}
            >
              <div className="flex items-center justify-center gap-2 px-4">
                <ChevronRight className={`h-4 w-4 rotate-180 transition-colors ${
                  isDraggingOverParent ? "text-amber-600" : "text-gray-400"
                }`} />
                <span className={`text-sm transition-colors ${
                  isDraggingOverParent 
                    ? "font-medium text-amber-700" 
                    : "text-gray-500"
                }`}>
                  {isDraggingOverParent 
                    ? "Soltá acá para mover a la carpeta anterior"
                    : "Arrastrá acá para mover a la carpeta anterior"
                  }
                </span>
              </div>
            </div>
          )}

          {/* Folders are rendered outside main droppable as they are droppables themselves */}
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

          {/* Documents in the current folder/root */}
          <div
            ref={dropZoneRef}
            className={`space-y-2 rounded-lg transition-all duration-200 ${
              isDraggingOver
                ? "bg-blue-50/80 border-2 border-blue-400 border-dashed p-4 shadow-inner"
                : ""
            }`}
          >
            {isDraggingOver && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 mb-2 rounded-md bg-blue-100/60 border border-blue-300/50">
                <Upload className="h-5 w-5 text-blue-600 animate-bounce" />
                <span className="text-sm font-medium text-blue-700">
                  Soltá acá para mover a{" "}
                  {currentFolderId ? "esta carpeta" : "la raíz"}
                </span>
              </div>
            )}

            {filteredDocuments.map((doc, index) => (
              <DocumentCard
                key={doc._id}
                document={doc}
                onEdit={setEditingDocument}
                onDelete={handleDeleteDocument}
                onDownload={handleDownloadDocument}
                viewMode={viewMode}
                index={index}
                currentFolderId={currentFolderId}
              />
            ))}
          </div>
        </div>

        {documentsStatus === "CanLoadMore" && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => loadMore(50)}
              variant="outline"
              disabled={isLoadingDocuments}
            >
              {isLoadingDocuments ? "Cargando..." : "Cargá más documentos"}
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalItems} {totalItems === 1 ? "elemento" : "elementos"}
        </p>
      </div>

      {/* Parent folder drop zone for grid view */}
      {currentFolder?.parentFolderId && (
        <div
          ref={parentDropZoneRef}
          className={`rounded-lg transition-all duration-200 flex items-center justify-center py-3 ${
            isDraggingOverParent
              ? "bg-amber-50/80 border-2 border-amber-400 border-dashed shadow-sm"
              : "border border-gray-200 bg-gray-50/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2 px-4">
            <ChevronRight className={`h-4 w-4 rotate-180 transition-colors ${
              isDraggingOverParent ? "text-amber-600" : "text-gray-400"
            }`} />
            <span className={`text-sm transition-colors ${
              isDraggingOverParent 
                ? "font-medium text-amber-700" 
                : "text-gray-500"
            }`}>
              {isDraggingOverParent 
                ? "Soltá acá para mover a la carpeta anterior"
                : "Arrastrá acá para mover a la carpeta anterior"
              }
            </span>
          </div>
        </div>
      )}

      <div
        ref={dropZoneRef}
        className={`grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 rounded-lg transition-all duration-200 ${
          isDraggingOver
            ? "bg-blue-50/50 border-2 border-blue-300 border-dashed"
            : ""
        }`}
      >
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
            currentFolderId={currentFolderId}
          />
        ))}
      </div>

      {totalItems === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            No hay documentos ni carpetas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Empežá subiendo un archivo o creando una carpeta
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
            {isLoadingDocuments ? "Cargando..." : "Cargá más documentos"}
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
  );
}
