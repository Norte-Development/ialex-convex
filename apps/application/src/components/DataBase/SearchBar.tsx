import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Search, X } from "lucide-react"

interface SearchBarProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: () => void
  onClearFilters: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  hasActiveFilters: boolean
}

export function SearchBar({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClearFilters,
  onKeyPress,
  hasActiveFilters,
}: SearchBarProps) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar en la legislación..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyPress={onKeyPress}
          className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-100"
        />
      </div>
      <Button onClick={onSearch} disabled={!searchQuery.trim() && !hasActiveFilters} className="px-6">
        Buscar
      </Button>
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} className="px-4 bg-transparent">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
