import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, FolderPlus, Bell, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LibraryHeaderProps {
  onCreateFolder: () => void;
  onUploadDocument: () => void;
}

export function LibraryHeader({
  onCreateFolder,
  onUploadDocument,
}: LibraryHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-8">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Biblioteca</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={onUploadDocument} size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Subir Archivo
          </Button>
          <Button
            onClick={onCreateFolder}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Nueva Carpeta
          </Button>
          <div className="ml-2 flex items-center gap-3 border-l border-border pl-3">
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="text-xs">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

