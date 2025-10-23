import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import ClientsTable from "./ClientsTable";
import { PaginationControls } from "../ui/pagination-controls";

interface ClientsTableContainerProps {
  searchQuery: string;
  pageSize: number;
}

export default function ClientsTableContainer({
  searchQuery,
  pageSize,
}: ClientsTableContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Query clients with pagination
  const clientsResult = useQuery(api.functions.clients.getClients, {
    search: searchQuery.trim() || undefined,
    paginationOpts: { 
      numItems: pageSize, 
      cursor: ((currentPage - 1) * pageSize).toString()
    },
  });

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Show loading state
  if (clientsResult === undefined) {
    return (
      <div className="w-full flex justify-center items-center py-8">
        <div className="text-gray-500">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <ClientsTable 
        clientsResult={clientsResult}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        searchQuery={searchQuery}
      />
    </div>
  );
}
