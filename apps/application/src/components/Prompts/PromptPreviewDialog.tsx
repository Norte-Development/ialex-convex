import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Tag, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PromptPreviewDialogProps {
  promptId: Id<"prompts"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PromptPreviewDialog({
  promptId,
  isOpen,
  onClose,
}: PromptPreviewDialogProps) {
  const prompt = useQuery(
    api.functions.prompts.getPrompt,
    promptId ? { promptId } : "skip",
  );

  const handleCopyPrompt = () => {
    if (prompt?.prompt) {
      navigator.clipboard.writeText(prompt.prompt);
      toast.success("Prompt copiado al portapapeles");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            {prompt ? prompt.titulo : "Cargando..."}
          </DialogTitle>
          <DialogDescription>Vista previa del prompt</DialogDescription>
        </DialogHeader>

        {!prompt ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex gap-2 items-center flex-wrap">
              <Badge
                variant="secondary"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {prompt.category}
              </Badge>
              {prompt.isPublic ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-[#10B981] bg-[#D1FAE5] border-[#10B981]"
                >
                  Público
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-[#6B7280] bg-[#F3F4F6] border-[#6B7280]"
                >
                  Privado
                </Badge>
              )}
              <Badge variant="secondary" className="bg-gray-100">
                {prompt.usageCount} usos
              </Badge>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Descripción
              </h3>
              <p className="text-sm text-gray-600">{prompt.descripcion}</p>
            </div>

            {/* Prompt text */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Texto del Prompt
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm whitespace-pre-wrap font-mono">
                  {prompt.prompt}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Los textos entre [corchetes] son placeholders que debes
                reemplazar
              </p>
            </div>

            {/* Tags */}
            {prompt.tags && prompt.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Etiquetas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Tag size={12} />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
