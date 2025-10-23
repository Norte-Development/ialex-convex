import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import { TeamMembersTable } from "./TeamMembersTable";
import { PaginationControls } from "../ui/pagination-controls";
import type { Id } from "../../../convex/_generated/dataModel";

interface TeamMembersTableContainerProps {
  teamId: Id<"teams">;
  pageSize: number;
  onRemoveMember: (memberId: string) => void;
  removingMember: string | null;
  isAdmin?: boolean;
}

export default function TeamMembersTableContainer({
  teamId,
  pageSize,
  onRemoveMember,
  removingMember,
  isAdmin = false,
}: TeamMembersTableContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Query team members with pagination
  const membersResult = useQuery(
    api.functions.teams.getTeamMembers,
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
  if (membersResult === undefined) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-12 w-full bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const members = membersResult?.page || [];

  return (
    <div className="w-full flex flex-col">
      <TeamMembersTable
        members={members}
        isLoading={false}
        onRemoveMember={onRemoveMember}
        removingMember={removingMember}
        isAdmin={isAdmin}
      />
      
      {/* Pagination controls */}
      {members.length > 0 && (
        <div className="mt-6">
          <PaginationControls
            totalResults={membersResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((membersResult?.totalCount || 0) / pageSize)}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
