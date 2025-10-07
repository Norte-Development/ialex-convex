import { useParams } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import CaseLayout from "@/components/Cases/CaseLayout";
import {
  Download,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/CasePermissionsContext";
import DocumentViewer from "@/components/Documents/DocumentViewer";
import { useDocxToHtml } from "@/hooks/useDocxToHtml";

export default function CaseDocumentPage() {
  const { documentId } = useParams();

  // Permisos usando el nuevo sistema
  const { can } = usePermissions();

  // Hook para conversión DOCX a HTML
  const { convertDocxToHtml, validateHtmlForTipTap, isConverting } =
    useDocxToHtml();

  // Estado para mostrar resultado de conversión
  const [conversionResult, setConversionResult] = useState<string | null>(null);

  // Fetch the specific document
  const document = useQuery(
    api.functions.documents.getDocument,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip",
  );

  // Action to get a signed URL for viewing/downloading the document
  const getDocumentUrlAction = useAction(
    api.functions.documents.getDocumentUrl,
  );
  const [documentUrl, setDocumentUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function loadUrl() {
      if (!documentId) return;
      try {
        const url = await getDocumentUrlAction({
          documentId: documentId as Id<"documents">,
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

  // Función para crear escrito desde DOCX
  const handleCreateEscrito = async () => {
    if (!document || !documentUrl) {
      console.error("No document or URL available");
      return;
    }

    // Solo permitir conversión de archivos DOCX
    if (
      document.mimeType !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setConversionResult(
        "Error: Solo se pueden convertir archivos DOCX a escritos.",
      );
      return;
    }

    try {
      console.log("Iniciando conversión de DOCX a HTML...");
      setConversionResult("Descargando documento...");

      // Descargar el archivo DOCX
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`Error descargando archivo: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      setConversionResult("Convirtiendo DOCX a HTML...");

      // Convertir DOCX a HTML
      const result = await convertDocxToHtml(arrayBuffer, {
        includeImages: false, // Por ahora sin imágenes para simplificar
        useCustomStyleMapping: true,
      });

      if (result.success) {
        console.log("Conversión exitosa:", result);

        // Validar HTML para TipTap
        const validation = validateHtmlForTipTap(result.html);

        let resultMessage = `✅ Conversión exitosa!\n\n`;
        resultMessage += `📊 Estadísticas:\n`;
        resultMessage += `- HTML generado: ${result.html.length} caracteres\n`;
        resultMessage += `- Texto extraído: ${result.text.length} caracteres\n`;

        if (result.analysis) {
          resultMessage += `- Párrafos: ${result.analysis.paragraphCount}\n`;
          resultMessage += `- Complejidad: ${result.analysis.estimatedComplexity}\n`;
          resultMessage += `- Tiene encabezados: ${result.analysis.hasHeadings ? "Sí" : "No"}\n`;
          resultMessage += `- Tiene tablas: ${result.analysis.hasTables ? "Sí" : "No"}\n`;
          resultMessage += `- Tiene imágenes: ${result.analysis.hasImages ? "Sí" : "No"}\n`;
        }

        if (result.messages.length > 0) {
          resultMessage += `\n⚠️ Advertencias:\n`;
          result.messages.forEach((msg) => {
            resultMessage += `- ${msg}\n`;
          });
        }

        if (!validation.isValid) {
          resultMessage += `\n🔍 Validación TipTap:\n`;
          validation.issues.forEach((issue) => {
            resultMessage += `- ⚠️ ${issue}\n`;
          });
          validation.suggestions.forEach((suggestion) => {
            resultMessage += `- 💡 ${suggestion}\n`;
          });
        } else {
          resultMessage += `\n✅ HTML compatible con TipTap\n`;
        }

        // Mostrar preview del HTML (primeros 500 caracteres)
        resultMessage += `\n📄 Preview HTML:\n`;
        resultMessage += `${result.html.substring(0, 1000)}${result.html.length > 1000 ? "..." : ""}`;

        setConversionResult(resultMessage);
      } else {
        console.error("Error en conversión:", result.error);
        setConversionResult(
          `❌ Error en conversión: ${result.error}\n\nTexto extraído como fallback:\n${result.text.substring(0, 500)}...`,
        );
      }
    } catch (error) {
      console.error("Error creando escrito:", error);
      setConversionResult(
        `❌ Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
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
            <h1 className="text-2xl font-semibold text-gray-900">
              {document.title}
            </h1>
            <div className="flex items-center gap-2">
              {/* Processing Status Badge - Prominent Display */}
              {document.processingStatus && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const statusConfig = getProcessingStatusConfig(
                      document.processingStatus,
                    );
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
                className={getDocumentTypeColor(
                  document.documentType || "other",
                )}
              >
                {getDocumentTypeText(document.documentType || "other")}
              </Badge>

              {can.docs.read && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(documentUrl || "", "_blank")}
                  disabled={!documentUrl}
                  title={
                    !documentUrl
                      ? "Documento no disponible"
                      : "Descargar documento"
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              )}

              {/* Botón para crear escrito desde DOCX */}
              {can.escritos.write &&
                document?.mimeType ===
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCreateEscrito}
                    disabled={!documentUrl || isConverting}
                    title="Convertir DOCX a escrito editable"
                  >
                    {isConverting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {isConverting ? "Convirtiendo..." : "Crear Escrito"}
                  </Button>
                )}
            </div>
          </div>

          {/* Processing Status Description */}
          {document.processingStatus && (
            <div className="mb-3">
              {(() => {
                const statusConfig = getProcessingStatusConfig(
                  document.processingStatus,
                );
                return (
                  <p
                    className={`text-sm ${statusConfig.color.replace("bg-", "text-").replace(" text-", "")}`}
                  >
                    {statusConfig.description}
                    {document.processingError && (
                      <span className="block mt-1 text-red-600">
                        Error: {document.processingError}
                      </span>
                    )}
                    {document.totalChunks &&
                      document.processingStatus === "completed" && (
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

      {/* Resultado de Conversión */}
      {conversionResult && (
        <div className="mx-6 mb-4 bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Resultado de Conversión DOCX → HTML
          </h3>
          <div className="bg-gray-50 p-4 rounded-md">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {conversionResult}
            </pre>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConversionResult(null)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Document Viewer */}
      <div className="flex-1 p-6 bg-gray-50">
        {can.docs.read ? (
          !documentUrl ? (
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
          )
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-gray-600">
              No te han dado permisos para ver este documento.
            </div>
          </div>
        )}
      </div>
    </CaseLayout>
  );
}
