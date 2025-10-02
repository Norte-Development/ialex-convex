import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface TemplatePreviewDialogProps {
  templateId: Id<"modelos"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatePreviewDialog({
  templateId,
  isOpen,
  onClose,
}: TemplatePreviewDialogProps) {
  const template = useQuery(
    api.functions.templates.getModelo,
    templateId ? { modeloId: templateId } : "skip",
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template?.name}</DialogTitle>
        </DialogHeader>
        <TemplatePreviewContent template={template} />
      </DialogContent>
    </Dialog>
  );
}

interface TemplatePreviewContentProps {
  template: any;
}

function TemplatePreviewContent({ template }: TemplatePreviewContentProps) {
  if (template === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!template?.content) {
    return <p className="text-muted-foreground">Esta plantilla no tiene contenido.</p>;
  }

  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: template.content }}
    />
  );
}
