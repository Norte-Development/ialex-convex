import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import CaseTable from "./CaseTable";
import { CaseTableSkeleton } from "./CaseTableSkeleton";
import { Id } from "../../../convex/_generated/dataModel";

interface CasesTableContainerProps {
  searchQuery: string;
  statusFilter:
    | "pendiente"
    | "en progreso"
    | "completado"
    | "archivado"
    | "cancelado"
    | undefined;
  clientId?: Id<"clients">;
  sortBy: string;
  sortOrder: "asc" | "desc";
  pageSize: number;
}

export default function CasesTableContainer({
  searchQuery,
  statusFilter,
  clientId,
  sortBy,
  sortOrder,
  pageSize,
}: CasesTableContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Query cases with pagination
  const casesResult = useQuery(api.functions.cases.getCases, {
    paginationOpts: {
      numItems: pageSize,
      cursor: ((currentPage - 1) * pageSize).toString(),
    },
    search: searchQuery.trim() || undefined,
    status: statusFilter,
    clientId: clientId,
    sortBy,
    sortOrder,
  });

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, clientId, sortBy, sortOrder]);

  // Show loading state
  if (casesResult === undefined) {
    return <CaseTableSkeleton />;
  }

  return (
    <CaseTable
      casesResult={casesResult}
      currentPage={currentPage}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      searchQuery={searchQuery}
    />
  );
}
