import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Folder,
  FolderOpen,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { IfCan } from "@/components/Permissions";
import { PERMISSIONS } from "@/permissions/types";
import { Id } from "convex/_generated/dataModel";
import type { Folder as FolderType } from "../../../types/folders";
import { Input } from "../ui/input";

interface CaseDocumentsProps {
  basePath: string;
}

export function CaseDocuments({ basePath }: CaseDocumentsProps) {
  const { currentCase } = useCase();
  const location = useLocation();
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"folders"> | undefined
  >(undefined);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch folders for the current case at current level
  const folders = useQuery(
    api.functions.folders.getFoldersForCase,
    currentCase
      ? { caseId: currentCase._id, parentFolderId: currentFolderId }
      : "skip",
  ) as FolderType[] | undefined;

  // Fetch breadcrumb path when inside a folder
  const breadcrumb = useQuery(
    api.functions.folders.getFolderPath,
    currentFolderId ? { folderId: currentFolderId } : "skip",
  ) as FolderType[] | undefined;

  // Fetch documents filtered by folder (root = no folderId)
  const documents = useQuery(
    api.functions.documents.getDocumentsInFolder,
    currentCase
      ? { caseId: currentCase._id, folderId: currentFolderId }
      : "skip",
  );

  const deleteDocument = useMutation(api.functions.documents.deleteDocument);
  const createFolder = useMutation(api.functions.folders.createFolder);

  const handleDeleteDocument = async (documentId: Id<"documents">) => {
    setDeletingDocumentId(documentId);
    try {
      await deleteDocument({ documentId });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  // Autofocus when opening the create input
  useEffect(() => {
    if (isCreatingFolder) {
      const t = setTimeout(() => newFolderInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isCreatingFolder]);

  const submitCreateFolder = async () => {
    if (!currentCase) return;
    const name = (newFolderName || "").trim() || "Nueva Carpeta";
    try {
      await createFolder({
        name,
        caseId: currentCase._id,
        parentFolderId: currentFolderId,
      } as any);
      setNewFolderName("");
      setIsCreatingFolder(false);
    } catch (err) {
      console.error("Error creating folder:", err);
      alert(err instanceof Error ? err.message : "No se pudo crear la carpeta");
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
          description: "Esperando indexación",
        };
      case "processing":
        return {
          icon: Loader2,
          color: "bg-blue-100 text-blue-800",
          text: "Indexando",
          description: "Analizando documento para búsqueda",
          animate: true,
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "bg-green-100 text-green-800",
          text: "Indexado",
          description: "Listo para búsqueda",
        };
      case "failed":
        return {
          icon: AlertCircle,
          color: "bg-red-100 text-red-800",
          text: "Error",
          description: "Error en indexación",
        };
      default:
        return {
          icon: Clock,
          color: "bg-gray-100 text-gray-800",
          text: "Desconocido",
          description: "Estado no disponible",
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
    <div className="flex flex-col gap-2 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-1 text-muted-foreground">
        <div className="flex items-center gap-1">
          <button
            className={`flex items-center gap-1 hover:text-foreground ${
              !currentFolderId ? "text-foreground font-medium" : ""
            }`}
            onClick={() => setCurrentFolderId(undefined)}
          >
            <FolderOpen size={14} /> Raíz
          </button>
          {breadcrumb && breadcrumb.length > 0 && (
            <>
              {breadcrumb.map((f, idx) => (
                <span key={f._id} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button
                    className={`hover:text-foreground ${
                      idx === breadcrumb.length - 1
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setCurrentFolderId(f._id)}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        <IfCan permission={PERMISSIONS.DOC_WRITE} fallback={null}>
          {!isCreatingFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 py-0 hover:bg-gray-100"
              onClick={() => setIsCreatingFolder(true)}
            >
              <Plus size={14} />
            </Button>
          )}
        </IfCan>
      </div>

      {/* Inline new folder input */}
      {isCreatingFolder && (
        <div className="flex items-center gap-2 p-1">
          <Input
            ref={newFolderInputRef}
            placeholder="Nombre de la carpeta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitCreateFolder();
              } else if (e.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            className="h-4 text-xs placeholder:text-xs"
          />
        </div>
      )}

      {/* Folders List */}
      {folders && folders.length > 0 && (
        <div className="flex flex-col gap-1">
          {folders.map((folder) => (
            <button
              key={folder._id}
              onClick={() => setCurrentFolderId(folder._id)}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Folder size={16} className="text-black flex-shrink-0" />
                <span className="truncate">{folder.name}</span>
              </span>
              {folder.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                  {folder.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Documents List */}
      {documents && documents.length > 0 ? (
        documents.map((document) => {
          const statusConfig = getProcessingStatusConfig(
            document.processingStatus,
          );
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
                  <IfCan permission={PERMISSIONS.DOC_DELETE} fallback={null}>
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
                              <Loader2
                                size={12}
                                className="text-gray-500 animate-spin"
                              />
                            ) : (
                              <Trash2 size={12} className="text-gray-500" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isDeleting
                              ? "Eliminando..."
                              : "Eliminar documento"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </IfCan>
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
                        <p className="text-red-600 mt-1">
                          Error: {document.processingError}
                        </p>
                      )}
                      {document.totalChunks && (
                        <p className="text-gray-600 mt-1">
                          Fragmentos: {document.totalChunks}
                        </p>
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
          {currentFolderId
            ? "No hay documentos en esta carpeta"
            : "No hay documentos en la raíz"}
        </div>
      )}
    </div>
  );
}
