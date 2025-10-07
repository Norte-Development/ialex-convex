import { Button } from "@/components/ui/button";
import { Eye, FilePlus } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface TemplateActionsProps {
  templateId: Id<"modelos">;
  onPreview: (templateId: Id<"modelos">) => void;
  onCreateFromTemplate: (template: { _id: Id<"modelos">; name: string }) => void;
  templateName: string;
  canCreate: boolean;
}

export function TemplateActions({
  templateId,
  onPreview,
  onCreateFromTemplate,
  templateName,
  canCreate,
}: TemplateActionsProps) {
  const handleCreate = () => {
    onCreateFromTemplate({ _id: templateId, name: templateName });
  };

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPreview(templateId)}
      >
        <Eye size={14} />
        Previsualizar
      </Button>
      <Button
        size="sm"
        onClick={handleCreate}
        disabled={!canCreate}
      >
        <FilePlus size={14} />
        Crear escrito
      </Button>
    </div>
  );
}
