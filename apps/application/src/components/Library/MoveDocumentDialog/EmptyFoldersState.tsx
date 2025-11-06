import { FolderOpen } from "lucide-react";

export function EmptyFoldersState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">
        No hay subcarpetas
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Esta carpeta está vacía
      </p>
    </div>
  );
}
