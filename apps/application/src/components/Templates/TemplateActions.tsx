import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Eye, FilePlus, ChevronDown } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface TemplateActionsProps {
  templateId: Id<"modelos">;
  onPreview: (templateId: Id<"modelos">) => void;
  onCreateFromTemplate: (template: {
    _id: Id<"modelos">;
    name: string;
  }) => void;
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-[#1868DB] border-[#1868DB] bg-[#E9F2FE]"
        >
          Crear <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPreview(templateId)}>
          <Eye className="mr-2 h-4 w-4" />
          Previsualizar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCreate} disabled={!canCreate}>
          <FilePlus className="mr-2 h-4 w-4" />
          Crear escrito
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
