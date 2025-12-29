import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HomeAgentMessageMedia Component
 * 
 * Displays a preview of a media attachment (image or PDF/file) within a chat message.
 */

interface HomeAgentMessageMediaProps {
  /** Type of media: "image" or "file" */
  type: "image" | "file";
  /** URL to the media resource */
  url: string;
  /** Original filename */
  filename?: string;
  /** Optional CSS classes */
  className?: string;
}

export function HomeAgentMessageMedia({
  type,
  url,
  filename,
  className,
}: HomeAgentMessageMediaProps) {
  const isImage = type === "image";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-xs shadow-sm w-fit max-w-[240px] mb-2",
        className
      )}
    >
      {isImage ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          <img
            src={url}
            alt={filename || "Imagen adjunta"}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground text-[11px] leading-tight">
          {filename || (isImage ? "Imagen" : "Documento")}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-500 hover:underline"
        >
          Ver archivo
        </a>
      </div>
    </div>
  );
}

