import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LibraryScope, SortOption, ViewMode } from "@/pages/LibraryPage";
import { FolderCard } from "./FolderCard";
import { DocumentCard } from "./DocumentCard";
import { useState } from "react";
import { EditFolderDialog } from "./EditFolderDialog";
import { EditDocumentDialog } from "./EditDocumentDialog";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { FileText } from "lucide-react";

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
  const [editingFolder, setEditingFolder] = useState<Doc<"libraryFolders"> | null>(null);
  const [editingDocument, setEditingDocument] = useState<Doc<"libraryDocuments"> | null>(null);

  // Fetch folders - userId is handled server-side via auth
  const folders = useQuery(
    api.functions.libraryFolders.getLibraryFolders,
    activeScope.type === "personal"
      ? { parentFolderId: currentFolderId }
      : { teamId: activeScope.teamId, parentFolderId: currentFolderId }
  );

  // Fetch documents - userId is handled server-side via auth
  const documents = useQuery(
    api.functions.libraryDocument.getLibraryDocuments,
    activeScope.type === "personal"
      ? { folderId: currentFolderId }
      : { teamId: activeScope.teamId, folderId: currentFolderId }
  );

  const deleteFolder = useMutation(api.functions.libraryFolders.deleteLibraryFolder);
  const deleteDocument = useMutation(api.functions.libraryDocument.deleteLibraryDocument);
  const getDocumentUrl = useAction(api.functions.libraryDocument.getLibraryDocumentUrl);

  // Filter and sort
  const filteredFolders = (folders || []).filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocuments = (documents || [])
    .filter((doc) => {
      const matchesSearch = doc.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType = typeFilter
        ? doc.mimeType.startsWith(typeFilter) || doc.mimeType.includes(typeFilter)
        : true;
      return matchesSearch && matchesType;
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
    const count = (documents || []).filter((doc) => doc.folderId === folderId)
      .length;
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
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              onEdit={setEditingDocument}
              onDelete={handleDeleteDocument}
              onDownload={handleDownloadDocument}
              viewMode={viewMode}
            />
          ))}
        </div>

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
        {filteredDocuments.map((doc) => (
          <DocumentCard
            key={doc._id}
            document={doc}
            onEdit={setEditingDocument}
            onDelete={handleDeleteDocument}
            onDownload={handleDownloadDocument}
            viewMode={viewMode}
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
            Comienza subiendo un archivo o creando una carpeta
          </p>
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

