import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import EscritosList from "./EscritosList";
import EscritosGridView from "./EscritosGridView";
import { PaginationControls } from "../ui/pagination-controls";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { LayoutGrid, List } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface EscritosListContainerProps {
  caseId: Id<"cases">;
  pageSize: number;
}

export default function EscritosListContainer({
  caseId,
  pageSize,
}: EscritosListContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // View mode state (list or grid)
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  // Search results (when searching)
  const searchResults = useQuery(
    api.functions.documents.searchEscritos,
    searchQuery.length >= 2 ? { caseId, query: searchQuery } : "skip",
  );

  // Query escritos with pagination (when not searching)
  const escritosResult = useQuery(
    api.functions.documents.getEscritos,
    !searchQuery
      ? {
          caseId,
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  // Determine which data to display
  const displayedEscritos = searchQuery ? searchResults : escritosResult?.page;
  const totalCount = searchQuery
    ? searchResults?.length || 0
    : escritosResult?.totalCount || 0;

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when caseId or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [caseId, searchQuery]);

  // Show loading state
  if ((searchQuery ? searchResults : escritosResult) === undefined) {
    return <div className="text-center py-12">Cargando escritos...</div>;
  }

  return (
    <div className="w-full flex flex-col">
      {/* Search Bar & View Toggle */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar escritos por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              {totalCount > 0
                ? `${totalCount} resultado${totalCount !== 1 ? "s" : ""} encontrado${totalCount !== 1 ? "s" : ""}`
                : "No se encontraron resultados"}
            </p>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="gap-2"
          >
            <LayoutGrid className="w-4 h-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Lista
          </Button>
        </div>
      </div>

      {/* Render based on view mode */}
      {viewMode === "list" ? (
        <EscritosList all_escritos={displayedEscritos} caseId={caseId} />
      ) : (
        <EscritosGridView escritos={displayedEscritos} />
      )}

      {/* Pagination controls - only show when not searching */}
      {!searchQuery && displayedEscritos && displayedEscritos.length > 0 && (
        <div className="mt-6 px-6">
          <PaginationControls
            totalResults={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil(totalCount / pageSize)}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
