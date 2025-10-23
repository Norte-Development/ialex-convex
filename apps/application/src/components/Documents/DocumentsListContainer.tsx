import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import DocumentsList from "./DocumentsList";
import { PaginationControls } from "../ui/pagination-controls";
import type { Id } from "../../../convex/_generated/dataModel";

interface DocumentsListContainerProps {
  caseId: Id<"cases">;
  currentFolderId?: Id<"folders">;
  pageSize: number;
  onFolderClick?: (folderId: Id<"folders">) => void;
  breadcrumb?: React.ReactNode;
  onCreateFolder?: () => void;
  onCreateDocument?: () => void;
}

export default function DocumentsListContainer({
  caseId,
  currentFolderId,
  pageSize,
  onFolderClick,
  breadcrumb,
  onCreateFolder,
  onCreateDocument,
}: DocumentsListContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Query documents with pagination
  const documentsResult = useQuery(
    api.functions.documents.getDocumentsInFolder,
    {
      caseId,
      folderId: currentFolderId,
      paginationOpts: { 
        numItems: pageSize, 
        cursor: ((currentPage - 1) * pageSize).toString()
      },
    }
  );

  // Query folders (these are typically fewer, so no pagination needed)
  const foldersResult = useQuery(
    api.functions.folders.getFoldersForCase,
    {
      caseId,
      parentFolderId: currentFolderId,
      paginationOpts: { numItems: 100, cursor: null }
    }
  );

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when folder changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId]);

  // Show loading state
  if (documentsResult === undefined || foldersResult === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Cargando documentos...</p>
      </div>
    );
  }

  const documents = documentsResult?.page || [];
  const folders = foldersResult?.page || [];

  return (
    <div className="w-full flex flex-col">
      <DocumentsList
        documents={documents}
        folders={folders}
        caseId={caseId}
        currentFolderId={currentFolderId}
        onFolderClick={onFolderClick}
        breadcrumb={breadcrumb}
        onCreateFolder={onCreateFolder}
        onCreateDocument={onCreateDocument}
      />
      
      {/* Pagination controls - only show if there are documents */}
      {documents.length > 0 && (
        <div className="mt-6 px-6">
          <PaginationControls
            totalResults={documentsResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((documentsResult?.totalCount || 0) / pageSize)}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
