import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import TeamCasesList from "./TeamCasesList";
import { PaginationControls } from "../ui/pagination-controls";
import type { Id } from "../../../convex/_generated/dataModel";

interface TeamCasesListContainerProps {
  teamId: Id<"teams">;
  pageSize: number;
}

export default function TeamCasesListContainer({
  teamId,
  pageSize,
}: TeamCasesListContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Query team cases with pagination
  const casesResult = useQuery(
    api.functions.teams.getCasesAccessibleByTeam,
    {
      teamId,
      paginationOpts: { 
        numItems: pageSize, 
        cursor: ((currentPage - 1) * pageSize).toString()
      },
    }
  );

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when teamId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [teamId]);

  // Show loading state
  if (casesResult === undefined) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Casos Accesibles</h3>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cases = casesResult?.page || [];

  return (
    <div className="w-full flex flex-col">
      <TeamCasesList teamId={teamId} casesResult={casesResult} />
      
      {/* Pagination controls - only show if there are cases */}
      {cases.length > 0 && (
        <div className="mt-6">
          <PaginationControls
            totalResults={casesResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((casesResult?.totalCount || 0) / pageSize)}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
