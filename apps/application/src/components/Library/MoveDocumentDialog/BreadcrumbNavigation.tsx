import { Home, ChevronRight } from "lucide-react";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

interface BreadcrumbNavigationProps {
  folderPath: Doc<"libraryFolders">[] | undefined;
  rootFolderId: Id<"libraryFolders"> | undefined;
  onNavigate: (folderId?: Id<"libraryFolders">) => void;
}

export function BreadcrumbNavigation({
  folderPath,
  rootFolderId,
  onNavigate,
}: BreadcrumbNavigationProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
      <button
        onClick={() => onNavigate(undefined)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3 w-3" />
        <span>Mi biblioteca</span>
      </button>
      {folderPath && folderPath.length > 0 && (
        <>
          {folderPath
            .filter((f) => f._id !== rootFolderId)
            .map((folder) => (
              <div key={folder._id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  onClick={() => onNavigate(folder._id)}
                  className="hover:text-foreground transition-colors truncate max-w-[100px]"
                >
                  {folder.name}
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
