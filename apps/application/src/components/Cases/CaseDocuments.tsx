// import { useMutation, useQuery } from "convex/react";
// import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
// import { Link } from "react-router-dom";
// import { useLocation } from "react-router-dom";
// import { Badge } from "../ui/badge";
// import { Button } from "../ui/button";
// import {
//   FileText,
//   Trash2,
//   AlertCircle,
//   CheckCircle,
//   Clock,
//   Loader2,
// } from "lucide-react";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "../ui/tooltip";
import { useState } from "react";
// import { IfCan } from "@/components/Permissions";
// import { PERMISSIONS } from "@/permissions/types";
import { Id } from "convex/_generated/dataModel";
import { FolderTree } from "./FolderTree";

interface CaseDocumentsProps {
  basePath: string;
}

export function CaseDocuments({ basePath }: CaseDocumentsProps) {
  const { currentCase } = useCase();
  // const location = useLocation();
  // const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
  //   null,
  // );
  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"folders"> | undefined
  >(undefined);
  // FolderTree handles fetching folders and breadcrumb

  // Fetch documents filtered by folder (root = no folderId)
  // const documents = useQuery(
  //   api.functions.documents.getDocumentsInFolder,
  //   currentCase
  //     ? { caseId: currentCase._id, folderId: currentFolderId }
  //     : "skip",
  // );

  // const deleteDocument = useMutation(api.functions.documents.deleteDocument);

  // const handleDeleteDocument = async (documentId: Id<"documents">) => {
  //   setDeletingDocumentId(documentId);
  //   try {
  //     await deleteDocument({ documentId });
  //   } finally {
  //     setDeletingDocumentId(null);
  //   }
  // };

  // // Folder selection handled by FolderTree

  // const getDocumentTypeColor = (documentType: string) => {
  //   switch (documentType) {
  //     case "contract":
  //       return "bg-blue-100 text-blue-800";
  //     case "evidence":
  //       return "bg-green-100 text-green-800";
  //     case "correspondence":
  //       return "bg-purple-100 text-purple-800";
  //     case "legal_brief":
  //       return "bg-orange-100 text-orange-800";
  //     case "court_filing":
  //       return "bg-red-100 text-red-800";
  //     default:
  //       return "bg-gray-100 text-gray-800";
  //   }
  // };

  // const getDocumentTypeText = (documentType: string) => {
  //   switch (documentType) {
  //     case "contract":
  //       return "Contrato";
  //     case "evidence":
  //       return "Evidencia";
  //     case "correspondence":
  //       return "Correspondencia";
  //     case "legal_brief":
  //       return "Escrito Legal";
  //     case "court_filing":
  //       return "Presentación Judicial";
  //     default:
  //       return "Otro";
  //   }
  // };

  // const getProcessingStatusConfig = (status: string | undefined) => {
  //   switch (status) {
  //     case "pending":
  //       return {
  //         icon: Clock,
  //         color: "bg-yellow-100 text-yellow-800",
  //         text: "Pendiente",
  //         description: "Esperando indexación",
  //       };
  //     case "processing":
  //       return {
  //         icon: Loader2,
  //         color: "bg-blue-100 text-blue-800",
  //         text: "Indexando",
  //         description: "Analizando documento para búsqueda",
  //         animate: true,
  //       };
  //     case "completed":
  //       return {
  //         icon: CheckCircle,
  //         color: "bg-green-100 text-green-800",
  //         text: "Indexado",
  //         description: "Listo para búsqueda",
  //       };
  //     case "failed":
  //       return {
  //         icon: AlertCircle,
  //         color: "bg-red-100 text-red-800",
  //         text: "Error",
  //         description: "Error en indexación",
  //       };
  //     default:
  //       return {
  //         icon: Clock,
  //         color: "bg-gray-100 text-gray-800",
  //         text: "Desconocido",
  //         description: "Estado no disponible",
  //       };
  //   }
  // };

  // const formatFileSize = (bytes: number) => {
  //   if (bytes === 0) return "0 Bytes";
  //   const k = 1024;
  //   const sizes = ["Bytes", "KB", "MB", "GB"];
  //   const i = Math.floor(Math.log(bytes) / Math.log(k));
  //   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  // };

  // const formatDate = (timestamp: number) => {
  //   return new Date(timestamp).toLocaleDateString("es-ES", {
  //     month: "short",
  //     day: "numeric",
  //   });
  // };

  return (
    <div className="flex flex-col gap-2 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
      {/* Folder tree */}
      {currentCase && (
        <FolderTree
          caseId={currentCase._id}
          currentFolderId={currentFolderId}
          onFolderChange={setCurrentFolderId}
          basePath={basePath}
        />
      )}
    </div>
  );
}
