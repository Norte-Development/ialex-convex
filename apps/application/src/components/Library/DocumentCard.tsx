import { Card } from "@/components/ui/card";
import {
  FileText,
  FileSpreadsheet,
  ImageIcon,
  MoreVertical,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ViewMode } from "@/pages/LibraryPage";
import { useNavigate } from "react-router-dom";

interface DocumentCardProps {
  document: Doc<"libraryDocuments">;
  onEdit: (document: Doc<"libraryDocuments">) => void;
  onDelete: (documentId: Id<"libraryDocuments">) => void;
  onDownload: (documentId: Id<"libraryDocuments">) => void;
  viewMode: ViewMode;
}

function getIcon(mimeType: string, color: string) {
  const iconClass = "h-10 w-10 text-white";

  if (mimeType.startsWith("image/")) {
    return (
      <div className={`rounded-lg ${color} p-3`}>
        <ImageIcon className={iconClass} />
      </div>
    );
  }

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return (
      <div className={`rounded-lg ${color} p-3`}>
        <FileSpreadsheet className={iconClass} />
      </div>
    );
  }

  // Default to document icon
  return (
    <div className={`rounded-lg ${color} p-3`}>
      <FileText className={iconClass} />
    </div>
  );
}

function getColor(mimeType: string): string {
  if (mimeType.includes("pdf")) return "bg-red-500";
  if (mimeType.includes("word") || mimeType.includes("document"))
    return "bg-blue-600";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "bg-green-600";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "bg-orange-500";
  if (mimeType.startsWith("image/")) return "bg-purple-500";
  return "bg-gray-500";
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function ProcessingStatusIcon({
  status,
}: {
  status?: "pending" | "processing" | "completed" | "failed";
}) {
  if (!status || status === "completed") return null;

  if (status === "pending") {
    return <Clock className="h-3 w-3 text-yellow-600" />;
  }
  if (status === "processing") {
    return <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />;
  }
  if (status === "failed") {
    return <AlertCircle className="h-3 w-3 text-red-600" />;
  }
  return null;
}

export function DocumentCard({
  document,
  onEdit,
  onDelete,
  onDownload,
  viewMode,
}: DocumentCardProps) {
  const navigate = useNavigate();
  const color = getColor(document.mimeType);

  const handleClick = () => {
    navigate(`/biblioteca/documento/${document._id}`);
  };

  if (viewMode === "list") {
    return (
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer">
        <div onClick={handleClick} className="flex items-center gap-4 flex-1">
          {getIcon(document.mimeType, color)}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{document.title}</p>
              <ProcessingStatusIcon status={document.processingStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(document.fileSize)}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDownload(document._id)}>
              Descargar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(document)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(document._id)}
              className="text-red-600"
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    );
  }

  return (
    <Card className="group relative flex flex-col items-center gap-3 p-4 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
      <div onClick={handleClick} className="flex flex-col items-center gap-3 w-full">
        {getIcon(document.mimeType, color)}
        <div className="w-full text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <p className="text-sm font-medium text-balance line-clamp-2">
              {document.title}
            </p>
            <ProcessingStatusIcon status={document.processingStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(document.fileSize)}
          </p>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDownload(document._id)}>
              Descargar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(document)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(document._id)}
              className="text-red-600"
            >
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

