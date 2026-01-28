import { useState, useRef } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import CaseLayout from "@/components/Cases/CaseLayout";
import DocumentsListContainer from "@/components/Documents/DocumentsListContainer";
import { DocumentsBreadcrumb } from "@/components/Documents/DocumentsBreadcrumb";
import { CreateFolderDialog } from "@/components/Documents/CreateFolderDialog";
import NewDocumentInput, {
  NewDocumentInputHandle,
} from "@/components/Cases/NewDocumentInput";
import { useCase } from "@/context/CaseContext";
import { toast } from "sonner";
import { UpgradeModal, useBillingData } from "@/components/Billing";

export default function DocumentListPage() {
  const { currentCase } = useCase();
  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"folders"> | undefined
  >(undefined);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const documentInputRef = useRef<NewDocumentInputHandle>(null);

  // Get current user plan for upgrade modal
  const { plan: userPlan } = useBillingData();

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

  const handleUpgradeRequired = () => {
    setShowUpgradeModal(true);
  };

  if (!currentCase) {
    return null;
  }

  return (
    <CaseLayout>
      <DocumentsListContainer
        caseId={currentCase._id as Id<"cases">}
        currentFolderId={currentFolderId}
        pageSize={20}
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
        onUpgradeRequired={handleUpgradeRequired}
        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/csv,application/vnd.ms-excel"
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason="Límite de 10 documentos por caso alcanzado."
        currentPlan={userPlan || "free"}
        recommendedPlan="premium_individual"
      />
    </CaseLayout>
  );
}
