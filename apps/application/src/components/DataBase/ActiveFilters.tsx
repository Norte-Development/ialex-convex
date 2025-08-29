import { Badge } from "../ui/badge"
import type { NormativeFilters } from "../../../types/legislation"

interface ActiveFiltersProps {
  searchQuery: string
  filters: NormativeFilters
  onRemoveFilter: (key: keyof NormativeFilters) => void
  onClearSearch: () => void
}

export function ActiveFilters({
  searchQuery,
  filters,
  onRemoveFilter,
  onClearSearch,
}: ActiveFiltersProps) {
  const activeFilters = Object.entries(filters).filter(([, value]) => value)

  if (!searchQuery && activeFilters.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
      <span className="text-sm font-medium text-gray-600">Filtros activos:</span>
      {searchQuery && (
        <Badge variant="secondary" className="gap-1">
          Búsqueda: "{searchQuery}"
          <button
            onClick={onClearSearch}
            className="hover:text-red-600"
          >
            ×
          </button>
        </Badge>
      )}
      {activeFilters.map(([key, value]) => (
        <Badge key={key} variant="secondary" className="gap-1">
          {key}: {String(value)}
          <button
            onClick={() => onRemoveFilter(key as keyof NormativeFilters)}
            className="hover:text-red-600"
          >
            ×
          </button>
        </Badge>
      ))}
    </div>
  )
}
