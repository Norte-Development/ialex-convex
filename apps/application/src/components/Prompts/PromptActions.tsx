import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Eye, Play, Edit, Trash2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface Prompt {
  _id: Id<"prompts">;
  titulo: string;
  category: string;
  descripcion: string;
  prompt: string;
  tags?: string[];
  isPublic: boolean;
  usageCount: number;
}

interface PromptActionsProps {
  promptId: Id<"prompts">;
  prompt: Prompt;
  onPreview: (promptId: Id<"prompts">) => void;
  onUsePrompt: (prompt: Prompt) => void;
  onEdit?: (promptId: Id<"prompts">) => void;
  onDelete?: (promptId: Id<"prompts">) => void;
  canEdit: boolean;
}

export function PromptActions({
  promptId,
  prompt,
  onPreview,
  onUsePrompt,
  onEdit,
  onDelete,
  canEdit,
}: PromptActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onPreview(promptId)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver prompt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUsePrompt(prompt)}>
          <Play className="mr-2 h-4 w-4" />
          Usar prompt
        </DropdownMenuItem>
        {canEdit && onEdit && !prompt.isPublic && (
          <DropdownMenuItem onClick={() => onEdit(promptId)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}
        {canEdit && onDelete && !prompt.isPublic && (
          <DropdownMenuItem
            onClick={() => onDelete(promptId)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
