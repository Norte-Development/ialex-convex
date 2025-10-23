import CaseCard from "./CaseCard";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { useState, useCallback } from "react";
import { PaginationControls } from "../ui/pagination-controls";

interface CaseGridProps {
  searchQuery?: string;
  statusFilter?: "pendiente" | "en progreso" | "completado" | "archivado" | "cancelado";
  pageSize?: number;
}

export default function CaseGrid({ 
  searchQuery = "", 
  statusFilter,
  pageSize = 20 
}: CaseGridProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const casesResult = useQuery(api.functions.cases.getCases, {
    paginationOpts: { 
      numItems: pageSize, 
      cursor: ((currentPage - 1) * pageSize).toString()
    },
    search: searchQuery.trim() || undefined,
    status: statusFilter,
  });

  const cases = casesResult?.page;
  const isLoading = casesResult === undefined;

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (isLoading) {
    return <div>Cargando casos...</div>;
  }

  if (cases && cases.length === 0) {
    return <div>No hay casos disponibles</div>;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-y-auto h-[calc(100vh-280px)]">
        {cases?.map((caseItem) => (
          <CaseCard
            key={caseItem._id}
            caseId={caseItem._id}
            title={caseItem.title}
            status={caseItem.status}
          />
        ))}
      </div>

      {/* Pagination controls */}
      {cases && cases.length > 0 && (
        <div className="flex-shrink-0">
          <PaginationControls
            totalResults={casesResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((casesResult?.totalCount || 0) / pageSize)}
            isSearchMode={!!searchQuery.trim()}
            searchQuery={searchQuery}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
