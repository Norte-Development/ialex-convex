import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ChevronRight, Home } from "lucide-react";

interface DocumentsBreadcrumbProps {
  currentFolderId: Id<"folders"> | undefined;
  onBreadcrumbClick: (folderId: Id<"folders"> | undefined) => void;
}

export function DocumentsBreadcrumb({
  currentFolderId,
  onBreadcrumbClick,
}: DocumentsBreadcrumbProps) {
  const folderPath = useQuery(
    api.functions.folders.getFolderPath,
    currentFolderId ? { folderId: currentFolderId } : "skip",
  );

  return (
    <div className="flex items-center gap-2 text-sm mb-4">
      <button
        onClick={() => onBreadcrumbClick(undefined)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span>Documentos</span>
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
