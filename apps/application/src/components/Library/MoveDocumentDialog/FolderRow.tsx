import { Button } from "@/components/ui/button";
import { Folder, ChevronRight } from "lucide-react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

interface FolderRowProps {
  folder: Doc<"libraryFolders">;
  onNavigate: (folderId: Id<"libraryFolders">) => void;
  onMove: (folderId: Id<"libraryFolders">) => void;
}

export function FolderRow({ folder, onNavigate, onMove }: FolderRowProps) {
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md transition-all hover:bg-muted/60 group border border-transparent hover:border-border">
      <Folder className="h-4 w-4 shrink-0 text-blue-500" />
      <button
        onClick={() => onNavigate(folder._id)}
        className="flex-1 truncate text-sm font-medium text-left"
      >
        {folder.name}
      </button>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onMove(folder._id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs"
      >
        Mover
      </Button>
      <button
        onClick={() => onNavigate(folder._id)}
        className="p-1 hover:bg-muted rounded transition-colors"
        aria-label="Abrir carpeta"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
