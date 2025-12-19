import { useRef } from "react";
import { Paperclip, FileText, ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HomeAgentMediaRef } from "./types";

interface HomeAgentFileUploadProps {
  media: HomeAgentMediaRef[];
  onSelectFiles: (files: FileList | File[]) => void;
  onRemove: (gcsObject: string) => void;
  isUploading: boolean;
}

export function HomeAgentFileUpload({
  media,
  onSelectFiles,
  onRemove,
  isUploading,
}: HomeAgentFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onSelectFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onSelectFiles(event.dataTransfer.files);
    }
  };

  return (
    <div className="mb-3">
      <div
        className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 transition-colors hover:border-muted-foreground/70"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4" />
            <span>Adjunta imágenes o PDFs (arrastra y suelta)</span>
          </div>
          <div className="flex items-center gap-2">
            {isUploading && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Subiendo...</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="text-xs"
              onClick={() => inputRef.current?.click()}
            >
              Seleccionar archivos
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {media.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {media.map((item) => (
              <div
                key={item.gcsObject}
                className="group relative flex items-center gap-2 rounded-md border bg-background/80 px-2 py-1 text-xs shadow-sm"
              >
                {item.kind === "image" ? (
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-muted">
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileText className="size-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="max-w-[180px] truncate font-medium text-foreground">
                    {item.filename}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {(item.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.gcsObject)}
                  className="ml-1 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`Quitar ${item.filename}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {media.length === 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ImageIcon className="size-3.5" />
            <span>Formatos permitidos: imágenes (PNG/JPG) y PDFs hasta 10MB.</span>
          </div>
        )}
      </div>
    </div>
  );
}
