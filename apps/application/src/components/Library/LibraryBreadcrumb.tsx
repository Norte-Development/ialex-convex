import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ChevronRight, Home } from "lucide-react";
import { LibraryScope } from "@/pages/LibraryPage";

interface LibraryBreadcrumbProps {
  currentFolderId: Id<"libraryFolders"> | undefined;
  onBreadcrumbClick: (folderId: Id<"libraryFolders"> | undefined) => void;
  activeScope: LibraryScope;
}

export function LibraryBreadcrumb({
  currentFolderId,
  onBreadcrumbClick,
  activeScope,
}: LibraryBreadcrumbProps) {
  const folderPath = useQuery(
    api.functions.libraryFolders.getLibraryFolderPath,
    currentFolderId ? { folderId: currentFolderId } : "skip"
  );

  const libraryName =
    activeScope.type === "personal" ? "Mi Biblioteca" : "Biblioteca del Equipo";

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onBreadcrumbClick(undefined)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span>{libraryName}</span>
      </button>

      {folderPath &&
        folderPath.map((folder, index) => (
          <div key={folder._id} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => onBreadcrumbClick(folder._id)}
              className={
                index === folderPath.length - 1
                  ? "rounded-md px-2 py-1 font-medium"
                  : "rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              }
            >
              {folder.name}
            </button>
          </div>
        ))}
    </div>
  );
}

