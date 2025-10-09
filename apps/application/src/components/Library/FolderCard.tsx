import { Card } from "@/components/ui/card";
import { Folder, MoreVertical } from "lucide-react";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ViewMode } from "@/pages/LibraryPage";

interface FolderCardProps {
  folder: Doc<"libraryFolders">;
  documentCount: number;
  onClick: (folderId: Id<"libraryFolders">) => void;
  onEdit: (folder: Doc<"libraryFolders">) => void;
  onDelete: (folderId: Id<"libraryFolders">) => void;
  viewMode: ViewMode;
}

export function FolderCard({
  folder,
  documentCount,
  onClick,
  onEdit,
  onDelete,
  viewMode,
}: FolderCardProps) {
  const colorClass = folder.color || "bg-blue-500";

  if (viewMode === "list") {
    return (
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer">
        <div onClick={() => onClick(folder._id)} className="flex items-center gap-4 flex-1">
          <div className={`rounded-lg ${colorClass} p-3`}>
            <Folder className="h-10 w-10 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{folder.name}</p>
            <p className="text-sm text-muted-foreground">
              {documentCount} {documentCount === 1 ? "archivo" : "archivos"}
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
            <DropdownMenuItem onClick={() => onEdit(folder)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(folder._id)}
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
      <div onClick={() => onClick(folder._id)} className="flex flex-col items-center gap-3 w-full">
        <div className={`rounded-lg ${colorClass} p-3`}>
          <Folder className="h-10 w-10 text-white" />
        </div>
        <div className="w-full text-center">
          <p className="text-sm font-medium text-balance line-clamp-2 mb-1">
            {folder.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {documentCount} {documentCount === 1 ? "archivo" : "archivos"}
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
            <DropdownMenuItem onClick={() => onEdit(folder)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(folder._id)}
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

