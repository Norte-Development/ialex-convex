import { FileText, X, Loader2 } from "lucide-react";
import type { HomeAgentMediaRef } from "./types";

interface HomeAgentAttachmentPreviewProps {
  media: HomeAgentMediaRef[];
  onRemove: (gcsObject: string) => void;
  isUploading: boolean;
}

export function HomeAgentAttachmentPreview({
  media,
  onRemove,
  isUploading,
}: HomeAgentAttachmentPreviewProps) {
  if (media.length === 0 && !isUploading) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2 pb-0">
      {media.map((item) => (
        <div
          key={item.gcsObject}
          className="group relative flex items-center gap-2 rounded-md border bg-background/80 px-2 py-1 text-xs shadow-sm"
        >
          {item.kind === "image" ? (
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-muted">
              <img
                src={item.url}
                alt={item.filename}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </div>
          )}
          <div className="min-w-0 max-w-[120px]">
            <div className="truncate font-medium text-foreground text-[10px] leading-tight">
              {item.filename}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {(item.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.gcsObject)}
            className="ml-1 rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={`Quitar ${item.filename}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {isUploading && (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span className="text-[10px]">Subiendo...</span>
        </div>
      )}
    </div>
  );
}
