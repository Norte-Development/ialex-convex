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
import { Droppable } from "react-beautiful-dnd";

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
      <Droppable
        droppableId={folder._id as unknown as string}
        type="LIBRARY_DOCUMENT"
        isDropDisabled={false}
        isCombineEnabled={false}
        ignoreContainerClipping={false}
        direction="vertical"
        mode="standard"
      >
        {(dropProvided, dropSnapshot) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className="relative"
          >
            <Card
              className={`transition-all duration-200 hover:bg-muted/50 ${
                dropSnapshot.isDraggingOver
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
                      dropSnapshot.isDraggingOver ? "scale-105" : ""
                    }`}
                  >
                    <Folder className="h-10 w-10 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{folder.name}</p>
                    <p
                      className={`text-sm text-muted-foreground truncate transition-colors ${
                        dropSnapshot.isDraggingOver
                          ? "text-blue-600 font-medium"
                          : ""
                      }`}
                    >
                      {documentCount}{" "}
                      {documentCount === 1 ? "archivo" : "archivos"}
                      {dropSnapshot.isDraggingOver &&
                        " · 📥 Suelta aquí para mover"}
                    </p>
                  </div>
                </div>
                <div
                  className="flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
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
                </div>
              </div>
              {dropSnapshot.isDraggingOver && (
                <div className="absolute inset-0 pointer-events-none rounded-lg" />
              )}
            </Card>
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }

  return (
    <Droppable
      droppableId={folder._id as unknown as string}
      type="LIBRARY_DOCUMENT"
      isDropDisabled={false}
      isCombineEnabled={false}
      ignoreContainerClipping={false}
      direction="vertical"
      mode="standard"
    >
      {(dropProvided, dropSnapshot) => (
        <div
          ref={dropProvided.innerRef}
          {...dropProvided.droppableProps}
          className="relative"
        >
          <Card
            className={`group relative flex flex-col items-center gap-3 p-4 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer min-h-[140px] ${
              dropSnapshot.isDraggingOver
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
                  dropSnapshot.isDraggingOver ? "scale-110" : ""
                }`}
              >
                <Folder className="h-10 w-10 text-white" />
              </div>
              <div className="w-full text-center">
                <p className="text-sm font-medium text-balance line-clamp-2 mb-1">
                  {folder.name}
                </p>
                <p
                  className={`text-xs transition-colors ${
                    dropSnapshot.isDraggingOver
                      ? "text-blue-600 font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {documentCount} {documentCount === 1 ? "archivo" : "archivos"}
                  {dropSnapshot.isDraggingOver && " · 📥 Suelta aquí"}
                </p>
              </div>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
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
          {dropProvided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
