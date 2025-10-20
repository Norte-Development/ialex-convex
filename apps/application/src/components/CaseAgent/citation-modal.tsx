import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NormativeDetails } from "@/components/DataBase/NormativeDetails";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

interface CitationModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  citationId: string;
  citationType: string;
}

/**
 * Modal unificado para mostrar detalles de citas
 * Soporta:
 * - 'leg': Legislación/Normativas
 * - 'doc': Documentos de la biblioteca (libraryDocuments)
 * - 'case-doc': Documentos de casos (documents)
 * - 'fallo': Fallos judiciales (futuro)
 */
export function CitationModal({
  open,
  setOpen,
  citationId,
  citationType,
}: CitationModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Actions y queries
  const getNormativeAction = useAction(
    api.functions.legislation.getNormativeById,
  );
  const getLibraryDocumentUrl = useAction(
    api.functions.libraryDocument.getLibraryDocumentUrl,
  );
  const getCaseDocumentUrl = useAction(
    api.functions.documents.getDocumentUrl,
  );

  // Query para documentos de biblioteca
  const libraryDocument = useQuery(
    api.functions.libraryDocument.getLibraryDocument,
    citationType === "doc" && citationId
      ? { documentId: citationId as Id<"libraryDocuments"> }
      : "skip",
  );

  // Query para documentos de casos
  const caseDocument = useQuery(
    api.functions.documents.getDocument,
    citationType === "case-doc" && citationId
      ? { documentId: citationId as Id<"documents"> }
      : "skip",
  );

  const handleDownloadDocument = async () => {
    if (!citationId) return;

    setIsDownloading(true);
    try {
      let url: string | null = null;
      
      if (citationType === "doc") {
        // Documento de biblioteca
        url = await getLibraryDocumentUrl({
          documentId: citationId as Id<"libraryDocuments">,
        });
      } else if (citationType === "case-doc") {
        // Documento de caso
        url = await getCaseDocumentUrl({
          documentId: citationId as Id<"documents">,
        });
      }

      if (url) {
        window.open(url, "_blank");
        toast.success("Documento descargado");
      } else {
        toast.error("No se pudo obtener la URL del documento");
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el documento");
    } finally {
      setIsDownloading(false);
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Renderizar contenido según el tipo
  const renderContent = () => {
    switch (citationType) {
      case "leg":
        // Legislación/Normativa
        return (
          <NormativeDetails
            jurisdiction="py"
            id={citationId}
            getNormativeAction={getNormativeAction}
          />
        );

      case "doc":
        // Documento de biblioteca
        if (!libraryDocument) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Header con ícono */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{libraryDocument.title}</h2>
                {libraryDocument.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {libraryDocument.description}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            {libraryDocument.tags && libraryDocument.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Etiquetas</h3>
                <div className="flex flex-wrap gap-2">
                  {libraryDocument.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Información del archivo */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                Información del archivo
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tipo:</dt>
                  <dd className="font-medium">{libraryDocument.mimeType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño:</dt>
                  <dd className="font-medium">
                    {formatFileSize(libraryDocument.fileSize)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subido:</dt>
                  <dd className="font-medium">
                    {formatDate(libraryDocument._creationTime)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Botón de descarga */}
            <Button
              onClick={handleDownloadDocument}
              disabled={isDownloading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Descargando..." : "Descargar documento"}
            </Button>
          </div>
        );

      case "case-doc":
        // Documento de caso
        if (!caseDocument) {
          return (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Header con ícono */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{caseDocument.title}</h2>
                {caseDocument.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {caseDocument.description}
                  </p>
                )}
              </div>
            </div>

            {/* Información del archivo */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                Información del archivo
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tipo:</dt>
                  <dd className="font-medium">{caseDocument.mimeType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tamaño:</dt>
                  <dd className="font-medium">
                    {formatFileSize(caseDocument.fileSize)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subido:</dt>
                  <dd className="font-medium">
                    {formatDate(caseDocument._creationTime)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Botón de descarga */}
            <Button
              onClick={handleDownloadDocument}
              disabled={isDownloading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Descargando..." : "Descargar documento"}
            </Button>
          </div>
        );

      case "fallo":
        // Fallos judiciales (futuro)
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Vista de fallos judiciales próximamente</p>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>Tipo de cita no reconocido: {citationType}</p>
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (citationType) {
      case "leg":
        return "Normativa";
      case "doc":
        return "Documento de Biblioteca";
      case "case-doc":
        return "Documento del Caso";
      case "fallo":
        return "Fallo Judicial";
      default:
        return "Cita";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="hidden">{getTitle()}</DialogTitle>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
