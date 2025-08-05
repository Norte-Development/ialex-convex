import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FileText, Trash2, AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useState } from "react";
import { Id } from "convex/_generated/dataModel";

interface CaseDocumentsProps {
  basePath: string;
}

export function CaseDocuments({ basePath }: CaseDocumentsProps) {
  const { currentCase } = useCase();
  const location = useLocation();
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  // Fetch documents for the current case
  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip"
  );

  const deleteDocument = useMutation(api.functions.documents.deleteDocument);

  const handleDeleteDocument = async (documentId: Id<"documents">) => {
    setDeletingDocumentId(documentId);
    try {
      await deleteDocument({ documentId });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const getDocumentTypeColor = (documentType: string) => {
    switch (documentType) {
      case "contract":
        return "bg-blue-100 text-blue-800";
      case "evidence":
        return "bg-green-100 text-green-800";
      case "correspondence":
        return "bg-purple-100 text-purple-800";
      case "legal_brief":
        return "bg-orange-100 text-orange-800";
      case "court_filing":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDocumentTypeText = (documentType: string) => {
    switch (documentType) {
      case "contract":
        return "Contrato";
      case "evidence":
        return "Evidencia";
      case "correspondence":
        return "Correspondencia";
      case "legal_brief":
        return "Escrito Legal";
      case "court_filing":
        return "Presentación Judicial";
      default:
        return "Otro";
    }
  };

  const getProcessingStatusConfig = (status: string | undefined) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "bg-yellow-100 text-yellow-800",
          text: "Pendiente",
          description: "Esperando indexación"
        };
      case "processing":
        return {
          icon: Loader2,
          color: "bg-blue-100 text-blue-800",
          text: "Indexando",
          description: "Analizando documento para búsqueda",
          animate: true
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800",
          text: "Indexado",
          description: "Listo para búsqueda"
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800",
          text: "Error",
          description: "Error en indexación"
        };
      default:
        return {
          icon: Clock,
          color: "bg-gray-100 text-gray-800",
          text: "Desconocido",
          description: "Estado no disponible"
        };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
      {/* Documents List */}
      {documents && documents.length > 0 ? (
        documents.map((document) => {
          const statusConfig = getProcessingStatusConfig(document.processingStatus);
          const StatusIcon = statusConfig.icon;
          const isDeleting = deletingDocumentId === document._id;
          
          return (
            <div
              key={document._id}
              className={`flex flex-col gap-1 p-2 rounded hover:bg-gray-50 ${
                location.pathname.includes(`/documentos/${document._id}`) 
                  ? "bg-blue-50 border-l-2 border-blue-500" 
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <Link 
                  to={`${basePath}/documentos/${document._id}`}
                  className="flex items-center gap-1 text-foreground hover:text-blue-600 flex-1 min-w-0"
                >
                  <FileText size={16} className="flex-shrink-0" />
                  <span className="truncate min-w-0">{document.title}</span>
                </Link>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteDocument(document._id);
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="text-gray-500 animate-spin" />
                          ) : (
                            <Trash2 size={12} className="text-gray-500" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isDeleting ? "Eliminando..." : "Eliminar documento"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              {/* Processing Status */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${statusConfig.color} flex items-center gap-1 ${
                          statusConfig.animate ? "animate-pulse" : ""
                        }`}
                      >
                        <StatusIcon 
                          size={10} 
                          className={statusConfig.animate ? "animate-spin" : ""} 
                        />
                        {statusConfig.text}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{statusConfig.description}</p>
                      {document.processingError && (
                        <p className="text-red-600 mt-1">Error: {document.processingError}</p>
                      )}
                      {document.totalChunks && (
                        <p className="text-gray-600 mt-1">Fragmentos: {document.totalChunks}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Document Type Badge */}
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getDocumentTypeColor(document.documentType || "other")}`}
                >
                  {getDocumentTypeText(document.documentType || "other")}
                </Badge>
              </div>
              
              {/* File Info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(document.fileSize)}</span>
                <span>{formatDate(document._creationTime)}</span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-muted-foreground text-xs p-2 text-center">
          No hay documentos
        </div>
      )}
    </div>
  );
} 