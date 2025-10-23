import { useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import CaseLayout from "@/components/Cases/CaseLayout";
import DocumentsList from "@/components/Documents/DocumentsList";
import { DocumentsBreadcrumb } from "@/components/Documents/DocumentsBreadcrumb";
import { CreateFolderDialog } from "@/components/Documents/CreateFolderDialog";
import NewDocumentInput, {
  NewDocumentInputHandle,
} from "@/components/Cases/NewDocumentInput";
import { useCase } from "@/context/CaseContext";
import { toast } from "sonner";

export default function DocumentListPage() {
  const { currentCase } = useCase();
  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"folders"> | undefined
  >(undefined);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const documentInputRef = useRef<NewDocumentInputHandle>(null);

  // Fetch documents for current folder (or root if no folder selected)
  const documents = useQuery(
    api.functions.documents.getDocumentsInFolder,
    currentCase
      ? {
          caseId: currentCase._id as Id<"cases">,
          folderId: currentFolderId,
        }
      : "skip",
  );

  // Fetch folders for current folder (or root if no folder selected)
  const folders = useQuery(
    api.functions.folders.getFoldersForCase,
    currentCase
      ? {
          caseId: currentCase._id as Id<"cases">,
          parentFolderId: currentFolderId,
        }
      : "skip",
  );

  const handleFolderClick = (folderId: Id<"folders">) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId: Id<"folders"> | undefined) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = () => {
    setIsCreateFolderOpen(true);
  };

  const handleCreateDocument = () => {
    documentInputRef.current?.open();
  };

  const handleDocumentSuccess = () => {
    toast.success("Documento subido exitosamente");
  };

  const handleDocumentError = (error: unknown) => {
    console.error("Error uploading document:", error);
    toast.error("Error al subir el documento");
  };

  if (!currentCase) {
    return null;
  }

  return (
    <CaseLayout>
      <DocumentsList
        documents={documents}
        folders={folders}
        caseId={currentCase._id as Id<"cases">}
        currentFolderId={currentFolderId}
        onFolderClick={handleFolderClick}
        onCreateFolder={handleCreateFolder}
        onCreateDocument={handleCreateDocument}
        breadcrumb={
          <DocumentsBreadcrumb
            currentFolderId={currentFolderId}
            onBreadcrumbClick={handleBreadcrumbClick}
          />
        }
      />
      <CreateFolderDialog
        open={isCreateFolderOpen}
        onOpenChange={setIsCreateFolderOpen}
        caseId={currentCase._id as Id<"cases">}
        parentFolderId={currentFolderId}
      />
      <NewDocumentInput
        ref={documentInputRef}
        caseId={currentCase._id as Id<"cases">}
        folderId={currentFolderId}
        onSuccess={handleDocumentSuccess}
        onError={handleDocumentError}
      />
    </CaseLayout>
  );
}
