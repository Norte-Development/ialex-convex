import { Button } from "../ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationControlsProps {
  totalResults: number
  page: number
  pageSize: number
  totalPages: number
  isSearchMode: boolean
  searchQuery: string
  onPageChange: (page: number) => void
}

export function PaginationControls({
  totalResults,
  page,
  pageSize,
  totalPages,
  isSearchMode,
  searchQuery,
  onPageChange,
}: PaginationControlsProps) {
  if (totalResults === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
      <div className="text-sm text-gray-600">
        Mostrando {(page - 1) * pageSize + 1} a{" "}
        {Math.min(page * pageSize, totalResults)} de {totalResults} resultados
        {isSearchMode && searchQuery && (
          <span className="font-medium"> para "{searchQuery}"</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-8 h-8 p-0"
              >
                {pageNum}
              </Button>
            )
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="gap-1"
        >
          Siguiente
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
