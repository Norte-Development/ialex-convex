import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import { TemplateTable } from "./TemplateTable";
import type { Id } from "../../../convex/_generated/dataModel";

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
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Use search when there's a search term, otherwise use regular list
  const hasSearchTerm = searchQuery.trim().length > 0;

  const searchResults = useQuery(
    api.functions.templates.searchModelos,
    hasSearchTerm
      ? {
          searchTerm: searchQuery.trim(),
          paginationOpts: { 
            numItems: pageSize, 
            cursor: ((currentPage - 1) * pageSize).toString()
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
            cursor: ((currentPage - 1) * pageSize).toString()
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

  return (
    <TemplateTable
      templates={filteredTemplates}
      isLoading={isLoadingTemplates}
      onPreview={onPreview}
      onCreateFromTemplate={onCreateFromTemplate}
      canCreate={canCreate}
      totalCount={templates?.totalCount || 0}
      currentPage={currentPage}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      searchQuery={searchQuery}
    />
  );
}
