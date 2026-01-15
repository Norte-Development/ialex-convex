import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import { TemplateTable } from "./TemplateTable";
import { TemplateEditDialog } from "./TemplateEditDialog";
import { TemplateDeleteDialog } from "./TemplateDeleteDialog";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/context/AuthContext";

interface TemplateTableContainerProps {
  searchQuery: string;
  pageSize: number;
  onPreview: (templateId: Id<"modelos">) => void;
  onCreateFromTemplate: (template: {
    _id: Id<"modelos">;
    name: string;
  }) => void;
  canCreate: boolean;
  showPublicOnly?: boolean; // If true, only show public templates
}

export default function TemplateTableContainer({
  searchQuery,
  pageSize,
  onPreview,
  onCreateFromTemplate,
  canCreate,
  showPublicOnly = false,
}: TemplateTableContainerProps) {
  // Get current user
  const { user } = useAuth();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<Id<"modelos"> | null>(
    null,
  );

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] =
    useState<Id<"modelos"> | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState("");

  // Use search when there's a search term, otherwise use regular list
  const hasSearchTerm = searchQuery.trim().length > 0;

  const searchResults = useQuery(
    api.functions.templates.searchModelos,
    hasSearchTerm
      ? {
          searchTerm: searchQuery.trim(),
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  const listResults = useQuery(
    api.functions.templates.getModelos,
    !hasSearchTerm
      ? {
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  const templates = hasSearchTerm ? searchResults : listResults;
  const isLoadingTemplates = templates === undefined;
  const modelos = templates?.page ?? [];

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filter templates based on showPublicOnly
  const filteredTemplates = showPublicOnly
    ? modelos.filter((t: any) => t.isPublic)
    : modelos;

  // Edit handlers
  const handleEdit = useCallback((templateId: Id<"modelos">) => {
    setEditTemplateId(templateId);
    setEditDialogOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditDialogOpen(false);
    setEditTemplateId(null);
  }, []);

  // Delete handlers
  const handleDelete = useCallback(
    (templateId: Id<"modelos">, templateName: string) => {
      setDeleteTemplateId(templateId);
      setDeleteTemplateName(templateName);
      setDeleteDialogOpen(true);
    },
    [],
  );

  const handleDeleteClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteTemplateId(null);
    setDeleteTemplateName("");
  }, []);

  return (
    <>
      <TemplateTable
        templates={filteredTemplates}
        isLoading={isLoadingTemplates}
        onPreview={onPreview}
        onCreateFromTemplate={onCreateFromTemplate}
        canCreate={canCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        currentUserId={user?._id ?? null}
        totalCount={templates?.totalCount || 0}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        searchQuery={searchQuery}
      />

      {/* Edit Dialog */}
      <TemplateEditDialog
        templateId={editTemplateId}
        isOpen={editDialogOpen}
        onClose={handleEditClose}
      />

      {/* Delete Dialog */}
      <TemplateDeleteDialog
        templateId={deleteTemplateId}
        templateName={deleteTemplateName}
        isOpen={deleteDialogOpen}
        onClose={handleDeleteClose}
      />
    </>
  );
}
