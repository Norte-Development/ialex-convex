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
import { Button } from "@/components/ui/button";
import { FileText, Tag, Lock, FilePlus, Pencil, Trash2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { TemplateActions } from "./TemplateActions";
import { PaginationControls } from "../ui/pagination-controls";

interface Template {
  _id: Id<"modelos">;
  name: string;
  category: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  createdBy: Id<"users"> | "system";
}

interface TemplateTableProps {
  templates: Template[];
  isLoading: boolean;
  onPreview: (templateId: Id<"modelos">) => void;
  onCreateFromTemplate: (template: {
    _id: Id<"modelos">;
    name: string;
  }) => void;
  canCreate: boolean;
  // Edit/Delete callbacks
  onEdit?: (templateId: Id<"modelos">) => void;
  onDelete?: (templateId: Id<"modelos">, templateName: string) => void;
  // Current user ID to check permissions
  currentUserId?: string | null;
  // Pagination props
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  searchQuery?: string;
}

export function TemplateTable({
  templates,
  isLoading,
  onPreview,
  onCreateFromTemplate,
  canCreate,
  onEdit,
  onDelete,
  currentUserId,
  totalCount = 0,
  currentPage = 1,
  pageSize = 20,
  onPageChange,
  searchQuery = "",
}: TemplateTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
        <FileText className="mb-2" />
        <p>No hay plantillas disponibles</p>
      </div>
    );
  }

  // Check if user can edit/delete a template
  const canModify = (template: Template): boolean => {
    if (!currentUserId) return false;
    if (template.createdBy === "system") return false;
    return template.createdBy === currentUserId;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <Table>
          <TableHeader className="bg-[#F5F5F5]">
            <TableRow>
              <TableHead className="text-left min-w-[180px]">Titulo</TableHead>
              <TableHead className="text-left min-w-[140px]">
                Etiquetas
              </TableHead>
              <TableHead className="text-left min-w-[120px]">
                Categoria
              </TableHead>
              <TableHead className="text-left min-w-[90px]">Estado</TableHead>
              <TableHead className="text-left min-w-[180px] max-w-[200px]">
                Descripcion
              </TableHead>
              <TableHead className="text-right min-w-[180px]">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template._id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>
                  {template.tags?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                        >
                          <Tag size={10} />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin etiquetas
                    </span>
                  )}
                </TableCell>
                <TableCell>{template.category}</TableCell>
                <TableCell>
                  {template.isPublic ? (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-[#1868DB] bg-[#E9F2FE] border-[#1868DB] text-xs"
                    >
                      <FilePlus size={10} /> Publico
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-[#1868DB] bg-[#E9F2FE] border-[#1868DB] text-xs"
                    >
                      <Lock size={10} /> Privado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="min-w-[180px] max-w-[200px] truncate text-sm">
                  {template.description ?? "Sin descripcion"}
                </TableCell>
                <TableCell className="text-right min-w-[180px]">
                  <div className="flex items-center justify-end gap-2">
                    {/* Edit/Delete buttons - only show if user can modify */}
                    {canModify(template) && (
                      <>
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(template._id)}
                            title="Editar modelo"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onDelete(template._id, template.name)
                            }
                            title="Eliminar modelo"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    {/* Existing actions dropdown */}
                    <TemplateActions
                      templateId={template._id}
                      templateName={template.name}
                      onPreview={onPreview}
                      onCreateFromTemplate={onCreateFromTemplate}
                      canCreate={canCreate}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {templates.length > 0 && onPageChange && totalCount > pageSize && (
        <PaginationControls
          totalResults={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={Math.ceil(totalCount / pageSize)}
          isSearchMode={!!searchQuery.trim()}
          searchQuery={searchQuery}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
