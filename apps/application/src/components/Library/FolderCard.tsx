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
import { useEffect, useRef, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

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
  const folderRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Setup drop target for this folder
  useEffect(() => {
    if (!folderRef.current) return;

    return dropTargetForElements({
      element: folderRef.current,
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
      getData: () => ({
        folderId: folder._id,
        type: "LIBRARY_DOCUMENT_DROP_ZONE",
      }),
    });
  }, [folder._id]);

  if (viewMode === "list") {
    return (
      <div ref={folderRef} className="relative">
        <Card
          className={`transition-all duration-200 hover:bg-muted/50 ${
            isDraggingOver
              ? "bg-blue-50/80 border-2 border-blue-400 border-dashed shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center gap-4 p-4">
            <div
              onClick={() => onClick(folder._id)}
              className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
            >
              <div
                className={`rounded-lg ${colorClass} p-3 flex-shrink-0 transition-transform ${
                  isDraggingOver ? "scale-105" : ""
                }`}
              >
                <Folder className="h-10 w-10 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{folder.name}</p>
                <p
                  className={`text-sm text-muted-foreground truncate transition-colors ${
                    isDraggingOver ? "text-blue-600 font-medium" : ""
                  }`}
                >
                  {documentCount} {documentCount === 1 ? "archivo" : "archivos"}
                  {isDraggingOver && " · Soltá acá para mover"}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(folder)}>
                    Editá
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(folder._id)}
                    className="text-red-600"
                  >
                    Borrá
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {isDraggingOver && (
            <div className="absolute inset-0 pointer-events-none rounded-lg" />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div ref={folderRef} className="relative">
      <Card
        className={`group relative flex flex-col items-center gap-3 p-4 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer h-40 ${
          isDraggingOver
            ? "bg-blue-50/80 border-2 border-blue-400 border-dashed scale-105 shadow-lg"
            : ""
        }`}
      >
        <div
          onClick={() => onClick(folder._id)}
          className="flex flex-col items-center gap-3 w-full"
        >
          <div
            className={`rounded-lg ${colorClass} p-3 transition-all ${
              isDraggingOver ? "scale-110" : ""
            }`}
          >
            <Folder className="h-10 w-10 text-white" />
          </div>
          <div className="w-full text-center px-2">
            <p
              className="text-sm font-medium truncate mb-1"
              title={folder.name}
            >
              {folder.name}
            </p>
            <p
              className={`text-xs transition-colors ${
                isDraggingOver
                  ? "text-blue-600 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {documentCount} {documentCount === 1 ? "archivo" : "archivos"}
              {isDraggingOver && " · 📥 Soltá acá"}
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
                Borrar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
}
