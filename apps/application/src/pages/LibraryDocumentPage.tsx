import { useParams, useNavigate } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Download,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
  ArrowLeft,
  FileText,
  Calendar,
  HardDrive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import DocumentViewer from "@/components/Documents/DocumentViewer";

export default function LibraryDocumentPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  // Fetch the specific document
  const document = useQuery(
    api.functions.libraryDocument.getLibraryDocument,
    documentId ? { documentId: documentId as Id<"libraryDocuments"> } : "skip"
  );

  // Action to get a signed URL for viewing/downloading the document
  const getDocumentUrlAction = useAction(
    api.functions.libraryDocument.getLibraryDocumentUrl
  );
  const [documentUrl, setDocumentUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function loadUrl() {
      if (!documentId) return;
      try {
        const url = await getDocumentUrlAction({
          documentId: documentId as Id<"libraryDocuments">,
        });
        if (!cancelled) setDocumentUrl(url || undefined);
      } catch (e) {
        if (!cancelled) setDocumentUrl(undefined);
      }
    }
    loadUrl();
    return () => {
      cancelled = true;
    };
  }, [documentId, getDocumentUrlAction]);

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

  const getProcessingStatusConfig = (status: string | undefined) => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          text: "Pendiente de indexación",
          description:
            "El documento está esperando ser procesado para búsqueda",
        };
      case "processing":
        return {
          icon: Loader2,
          color: "bg-blue-100 text-blue-800 border-blue-200",
          text: "Indexando documento",
          description: "Analizando el contenido para hacerlo buscable",
          animate: true,
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800 border-green-200",
          text: "Indexado",
          description: "El documento está listo para búsqueda",
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800 border-red-200",
          text: "Error de indexación",
          description: "No se pudo procesar el documento",
        };
      default:
        return {
          icon: Clock,
          color: "bg-gray-100 text-gray-800 border-gray-200",
          text: "Estado desconocido",
          description: "No se puede determinar el estado del documento",
        };
    }
  };

  if (!document) {
    return (
      <section className="w-full h-full min-h-screen bg-white flex py-8 px-8 flex-col gap-6 mt-12">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  const statusConfig = getProcessingStatusConfig(document.processingStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <section className="w-full h-full min-h-screen bg-white flex py-8 px-8 flex-col gap-6 mt-12">
      {/* Back Button & Title */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/biblioteca")}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
          {document.description && (
            <p className="text-sm text-muted-foreground">{document.description}</p>
          )}
        </div>
        <Button
          variant="default"
          onClick={() => window.open(documentUrl || "", "_blank")}
          disabled={!documentUrl}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Descargar
        </Button>
      </div>

      {/* Document Metadata Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6">
            {/* Processing Status */}
            {document.processingStatus && (
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`${statusConfig.color} flex items-center gap-1.5 ${
                        statusConfig.animate ? "animate-pulse" : ""
                      }`}
                    >
                      <StatusIcon
                        size={14}
                        className={statusConfig.animate ? "animate-spin" : ""}
                      />
                      {statusConfig.text}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {statusConfig.description}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tamaño del archivo</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(document.fileSize)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Fecha de subida</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(document._creationTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tipo de archivo</p>
                  <p className="text-sm text-muted-foreground">
                    {document.mimeType}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            {document.tags && document.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-2">
                    {document.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Viewer */}
      <Card className="flex-1">
        <CardContent className="p-6">
          {!documentUrl ? (
            <div className="flex items-center justify-center h-[600px]">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Cargando documento...
                </p>
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
        </CardContent>
      </Card>
    </section>
  );
}

