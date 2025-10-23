import { Button } from "./button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { memo } from "react"

interface PaginationControlsProps {
  // Core pagination data
  totalResults: number
  currentPage: number
  pageSize: number
  totalPages: number
  
  // Search/filter context
  isSearchMode?: boolean
  searchQuery?: string
  
  // Event handlers
  onPageChange: (page: number) => void
  
  // Customization options
  showResultsCount?: boolean
  maxVisiblePages?: number
  className?: string
  
  // Localization
  previousLabel?: string
  nextLabel?: string
  resultsLabel?: string
}

const PaginationControls = memo(function PaginationControls({
  totalResults,
  currentPage,
  pageSize,
  totalPages,
  isSearchMode = false,
  searchQuery = "",
  onPageChange,
  showResultsCount = true,
  maxVisiblePages = 5,
  className = "",
  previousLabel = "Anterior",
  nextLabel = "Siguiente",
  resultsLabel = "Mostrando",
}: PaginationControlsProps) {
  // Don't render if no results
  if (totalResults === 0) {
    return null
  }

  // Calculate result range
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalResults)

  // Generate page numbers to display
  const generatePageNumbers = () => {
    const pages = []
    const visiblePages = Math.min(maxVisiblePages, totalPages)
    const startPage = Math.max(1, Math.min(totalPages - visiblePages + 1, currentPage - Math.floor(visiblePages / 2)))
    
    for (let i = 0; i < visiblePages; i++) {
      const pageNum = startPage + i
      if (pageNum <= totalPages) {
        pages.push(pageNum)
      }
    }
    
    return pages
  }

  const pageNumbers = generatePageNumbers()

  return (
    <nav 
      className={`flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-lg border border-gray-200 gap-4 ${className}`}
      aria-label="Pagination navigation"
      role="navigation"
    >
      {/* Results count display */}
      {showResultsCount && (
        <div className="text-sm text-gray-600 text-center sm:text-left">
          {resultsLabel} {startItem} a {endItem} de {totalResults} resultados
          {isSearchMode && searchQuery && (
            <span className="font-medium"> para "{searchQuery}"</span>
          )}
        </div>
      )}
      
      {/* Pagination controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="gap-1"
          aria-label={`Go to ${previousLabel.toLowerCase()} page`}
          title={`${previousLabel} page`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{previousLabel}</span>
          <span className="sm:hidden">‹</span>
        </Button>
        
        {/* Page number buttons */}
        <div className="flex items-center gap-1" role="group" aria-label="Page numbers">
          {pageNumbers.map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-8 h-8 p-0 min-w-[2rem]"
              aria-label={`Go to page ${pageNum}`}
              aria-current={pageNum === currentPage ? "page" : undefined}
              title={`Page ${pageNum}`}
            >
              {pageNum}
            </Button>
          ))}
        </div>
        
        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="gap-1"
          aria-label={`Go to ${nextLabel.toLowerCase()} page`}
          title={`${nextLabel} page`}
        >
          <span className="hidden sm:inline">{nextLabel}</span>
          <span className="sm:hidden">›</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  )
})

export { PaginationControls }
export type { PaginationControlsProps }
