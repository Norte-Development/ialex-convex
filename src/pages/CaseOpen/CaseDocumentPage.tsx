import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import CaseLayout from "@/components/Cases/CaseLayout";
import { Download, AlertCircle, Clock, Loader2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContextPermissionButton } from "@/components/Permissions/ContextPermissionButton";
import { ContextCan } from "@/components/Permissions/ContextCan";
import { PERMISSIONS } from "@/permissions/types";
import DocumentViewer from "@/components/Documents/DocumentViewer";

export default function CaseDocumentPage() {
  const { documentId } = useParams();
  

  // Fetch the specific document
  const document = useQuery(
    api.functions.documents.getDocument,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

  // Get the document URL from Convex storage
  const documentUrl = useQuery(
    api.functions.documents.getDocumentUrl,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Viewer helpers handled in DocumentViewer

  const getProcessingStatusConfig = (status: string | undefined) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          text: "Pendiente de indexación",
          description: "El documento está esperando ser procesado para búsqueda"
        };
      case "processing":
        return {
          icon: Loader2,
          color: "bg-blue-100 text-blue-800 border-blue-200",
          text: "Indexando documento",
          description: "Analizando el contenido para hacerlo buscable",
          animate: true
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800 border-green-200",
          text: "Indexado",
          description: "El documento está listo para búsqueda"
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800 border-red-200",
          text: "Error de indexación",
          description: "No se pudo procesar el documento"
        };
      default:
        return {
          icon: Clock,
          color: "bg-gray-100 text-gray-800 border-gray-200",
          text: "Estado desconocido",
          description: "No se puede determinar el estado del documento"
        };
    }
  };

  if (!document) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      {/* Document Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold text-gray-900">{document.title}</h1>
            <div className="flex items-center gap-2">
              {/* Processing Status Badge - Prominent Display */}
              {document.processingStatus && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const statusConfig = getProcessingStatusConfig(document.processingStatus);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <Badge 
                        variant="outline" 
                        className={`${statusConfig.color} flex items-center gap-2 px-3 py-1 text-sm font-medium ${
                          statusConfig.animate ? "animate-pulse" : ""
                        }`}
                      >
                        <StatusIcon 
                          size={16} 
                          className={statusConfig.animate ? "animate-spin" : ""} 
                        />
                        {statusConfig.text}
                      </Badge>
                    );
                  })()}
                </div>
              )}
              
              <Badge 
                variant="secondary" 
                className={getDocumentTypeColor(document.documentType || "other")}
              >
                {getDocumentTypeText(document.documentType || "other")}
              </Badge>
              
              <ContextPermissionButton
                permission={PERMISSIONS.DOC_READ}
                variant="outline"
                size="sm"
                onClick={() => window.open(documentUrl || "", "_blank")}
                disabled={!documentUrl}
                disabledMessage="No tienes permisos para descargar documentos"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </ContextPermissionButton>
            </div>
          </div>
          
          {/* Processing Status Description */}
          {document.processingStatus && (
            <div className="mb-3">
              {(() => {
                const statusConfig = getProcessingStatusConfig(document.processingStatus);
                return (
                  <p className={`text-sm ${statusConfig.color.replace('bg-', 'text-').replace(' text-', '')}`}>
                    {statusConfig.description}
                    {document.processingError && (
                      <span className="block mt-1 text-red-600">
                        Error: {document.processingError}
                      </span>
                    )}
                    {document.totalChunks && document.processingStatus === "completed" && (
                      <span className="block mt-1 text-gray-600">
                        Fragmentos procesados: {document.totalChunks}
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">Tamaño:</span>
              <span>{formatFileSize(document.fileSize)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Subido:</span>
              <span>{formatDate(document._creationTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Tipo:</span>
              <span>{document.mimeType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 p-6 bg-gray-50">
        <ContextCan
          permission={PERMISSIONS.DOC_READ}
          fallback={
            <div className="flex items-center justify-center h-96">
              <div className="text-center text-gray-600">
                No te han dado permisos para ver este documento.
              </div>
            </div>
          }
        >
          {!documentUrl ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Skeleton className="h-64 w-96 mb-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ) : (
            <DocumentViewer
              url={documentUrl}
              mimeType={document.mimeType}
              title={document.title}
              fileSize={document.fileSize}
            />
          )}
        </ContextCan>
      </div>
    </CaseLayout>
  );
} 