import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import TeamCard from "./TeamCard";
import { PaginationControls } from "../ui/pagination-controls";

interface TeamsContainerProps {
  pageSize: number;
}

export default function TeamsContainer({
  pageSize,
}: TeamsContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Query teams with pagination
  const teamsResult = useQuery(api.functions.teams.getTeams, {
    paginationOpts: { 
      numItems: pageSize, 
      cursor: ((currentPage - 1) * pageSize).toString()
    },
  });

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Show loading state
  if (teamsResult === undefined) {
    return (
      <div className="w-full flex justify-center items-center py-8">
        <div className="text-gray-500">Cargando equipos...</div>
      </div>
    );
  }

  const teams = teamsResult?.page || [];

  return (
    <div className="w-full flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
        {teams.map((team: any) => (
          <TeamCard key={team._id} team={team} />
        ))}
      </div>
      
      {/* Pagination controls */}
      {teams.length > 0 && (
        <div className="mt-4">
          <PaginationControls
            totalResults={teamsResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((teamsResult?.totalCount || 0) / pageSize)}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
