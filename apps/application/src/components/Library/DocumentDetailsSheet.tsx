import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Download, Edit, Trash2, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

interface DocumentDetailsSheetProps {
  document: Doc<"libraryDocuments"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProcessingStatusConfig(status: string | undefined) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        text: "Pendiente",
        description: "El documento está esperando ser procesado",
      };
    case "processing":
      return {
        icon: Loader2,
        color: "bg-blue-100 text-blue-800 border-blue-200",
        text: "Procesando",
        description: "Analizando el contenido del documento",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckCircle,
        color: "bg-green-100 text-green-800 border-green-200",
        text: "Procesado",
        description: "El documento está listo",
      };
    case "failed":
      return {
        icon: AlertCircle,
        color: "bg-red-100 text-red-800 border-red-200",
        text: "Error",
        description: "No se pudo procesar el documento",
      };
    default:
      return {
        icon: Clock,
        color: "bg-gray-100 text-gray-800 border-gray-200",
        text: "Desconocido",
        description: "Estado del documento desconocido",
      };
  }
}

export function DocumentDetailsSheet({
  document,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: DocumentDetailsSheetProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const getDocumentUrl = useAction(
    api.functions.libraryDocument.getLibraryDocumentUrl
  );

  const handleDownload = async () => {
    if (!document) return;

    setIsDownloading(true);
    try {
      const url = await getDocumentUrl({ documentId: document._id });
      window.open(url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "No se pudo descargar el documento");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!document) return null;

  const statusConfig = getProcessingStatusConfig(document.processingStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{document.title}</SheetTitle>
          <SheetDescription>Detalles del documento</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Processing Status */}
          {document.processingStatus && (
            <div>
              <h3 className="text-sm font-medium mb-2">Estado</h3>
              <Badge
                variant="outline"
                className={`${statusConfig.color} flex items-center gap-2 w-fit px-3 py-1 ${
                  statusConfig.animate ? "animate-pulse" : ""
                }`}
              >
                <StatusIcon
                  size={16}
                  className={statusConfig.animate ? "animate-spin" : ""}
                />
                {statusConfig.text}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {statusConfig.description}
              </p>
            </div>
          )}

          {/* Description */}
          {document.description && (
            <div>
              <h3 className="text-sm font-medium mb-2">Descripción</h3>
              <p className="text-sm text-muted-foreground">
                {document.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* File Info */}
          <div>
            <h3 className="text-sm font-medium mb-2">Información del archivo</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tipo:</dt>
                <dd className="font-medium">{document.mimeType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tamaño:</dt>
                <dd className="font-medium">
                  {formatFileSize(document.fileSize)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subido:</dt>
                <dd className="font-medium">
                  {formatDate(document._creationTime)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Descargando..." : "Descargar"}
            </Button>
            <Button onClick={onEdit} variant="outline" className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              onClick={onDelete}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

