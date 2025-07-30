import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FileText, Download, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface CaseDocumentsProps {
  basePath: string;
}

export function CaseDocuments({ basePath }: CaseDocumentsProps) {
  const { currentCase } = useCase();
  const location = useLocation();

  // Fetch documents for the current case
  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip"
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
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
      {/* Documents List */}
      {documents && documents.length > 0 ? (
        documents.map((document) => (
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
                          // TODO: Implement delete functionality
                        }}
                      >
                        <Trash2 size={12} className="text-gray-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Eliminar documento</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getDocumentTypeColor(document.documentType || "other")}`}
                >
                  {getDocumentTypeText(document.documentType || "other")}
                </Badge>
                <span>{formatFileSize(document.fileSize)}</span>
              </div>
              <span>{formatDate(document._creationTime)}</span>
            </div>
          </div>
        ))
      ) : (
        <div className="text-muted-foreground text-xs p-2 text-center">
          No hay documentos
        </div>
      )}
    </div>
  );
} 