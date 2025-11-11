import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Tag, Globe, Lock } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { PromptActions } from "./PromptActions";
import { useChatbot } from "@/context/ChatbotContext";

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

interface PromptTableProps {
  prompts: Prompt[];
  isLoading: boolean;
  onPreview: (promptId: Id<"prompts">) => void;
  onUsePrompt: (prompt: Prompt) => void;
  onEdit?: (promptId: Id<"prompts">) => void;
  onDelete?: (promptId: Id<"prompts">) => void;
  canEdit: boolean;
}

export function PromptTable({
  prompts,
  isLoading,
  onPreview,
  onUsePrompt,
  onEdit,
  onDelete,
  canEdit,
}: PromptTableProps) {
  const { isChatbotOpen } = useChatbot();

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <MessageSquare className="mb-4 h-12 w-12 text-gray-400" />
        <p className="text-lg font-medium">No hay prompts disponibles</p>
        <p className="text-sm text-muted-foreground mt-2">
          Crea tu primer prompt personalizado o explora la biblioteca
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader className="bg-[#F5F5F5]">
          <TableRow>
            <TableHead className="text-left">Título</TableHead>
            {!isChatbotOpen && (
              <TableHead className="text-left">Categoría</TableHead>
            )}
            {!isChatbotOpen && (
              <TableHead className="text-left">Descripción</TableHead>
            )}
            {!isChatbotOpen && (
              <TableHead className="text-left">Etiquetas</TableHead>
            )}
            {!isChatbotOpen && (
              <TableHead className="text-center">Usos</TableHead>
            )}
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map((prompt) => (
            <TableRow key={prompt._id} className="hover:bg-gray-50">
              <TableCell className="font-medium">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-1 text-blue-600 shrink-0" />
                  <div className="flex flex-col gap-1">
                    <span
                      className={
                        isChatbotOpen ? "line-clamp-1" : "line-clamp-2"
                      }
                    >
                      {prompt.titulo}
                    </span>
                    {isChatbotOpen && (
                      <div className="flex flex-wrap gap-1 items-center">
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                        >
                          {prompt.category}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-xs"
                        >
                          {prompt.usageCount} usos
                        </Badge>
                      </div>
                    )}
                    {!isChatbotOpen && (
                      <>
                        {prompt.isPublic ? (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 text-[#10B981] bg-[#D1FAE5] border-[#10B981] w-fit"
                          >
                            <Globe size={12} /> Público
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1 text-[#6B7280] bg-[#F3F4F6] border-[#6B7280] w-fit"
                          >
                            <Lock size={12} /> Privado
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </TableCell>
              {!isChatbotOpen && (
                <TableCell>
                  <Badge
                    variant="secondary"
                    className="bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {prompt.category}
                  </Badge>
                </TableCell>
              )}
              {!isChatbotOpen && (
                <TableCell className="max-w-[300px]">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {prompt.descripcion}
                  </p>
                </TableCell>
              )}
              {!isChatbotOpen && (
                <TableCell>
                  {prompt.tags && prompt.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {prompt.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs flex items-center gap-1"
                        >
                          <Tag size={10} />
                          {tag}
                        </Badge>
                      ))}
                      {prompt.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{prompt.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin etiquetas
                    </span>
                  )}
                </TableCell>
              )}
              {!isChatbotOpen && (
                <TableCell className="text-center">
                  <Badge variant="secondary" className="bg-gray-100">
                    {prompt.usageCount}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="text-right">
                <PromptActions
                  promptId={prompt._id}
                  prompt={prompt}
                  onPreview={onPreview}
                  onUsePrompt={onUsePrompt}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canEdit={canEdit}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
