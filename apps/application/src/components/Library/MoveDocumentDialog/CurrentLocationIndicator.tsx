import { Home, FolderOpen } from "lucide-react";
import { Doc } from "../../../../convex/_generated/dataModel";

interface CurrentLocationIndicatorProps {
  isRootView: boolean;
  currentViewFolder: Doc<"libraryFolders"> | null | undefined;
}

export function CurrentLocationIndicator({
  isRootView,
  currentViewFolder,
}: CurrentLocationIndicatorProps) {
  return (
    <div className="px-6 py-3 border-b">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Ubicación actual:
        </span>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {isRootView ? (
            <>
              <Home className="h-3.5 w-3.5 text-blue-500" />
              <span>Mi biblioteca</span>
            </>
          ) : (
            <>
              <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>{currentViewFolder?.name || "Cargando..."}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
