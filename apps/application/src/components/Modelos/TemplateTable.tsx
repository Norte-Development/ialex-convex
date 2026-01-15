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
import { FileText, Tag, Lock, FilePlus } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <Table>
          <TableHeader className="bg-[#F5F5F5]">
            <TableRow>
              <TableHead className="text-left min-w-[180px]">Título</TableHead>
              <TableHead className="text-left min-w-[140px]">Etiquetas</TableHead>
              <TableHead className="text-left min-w-[120px]">Categoría</TableHead>
              <TableHead className="text-left min-w-[90px]">Estado</TableHead>
              <TableHead className="text-left min-w-[180px] max-w-[200px]">Descripción</TableHead>
              <TableHead className="text-right min-w-[100px]">Acciones</TableHead>
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
                      <FilePlus size={10} /> Público
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
                  {template.description ?? "Sin descripción"}
                </TableCell>
                <TableCell className="text-right min-w-[100px]">
                  <TemplateActions
                    templateId={template._id}
                    templateName={template.name}
                    onPreview={onPreview}
                    onCreateFromTemplate={onCreateFromTemplate}
                    canCreate={canCreate}
                  />
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
