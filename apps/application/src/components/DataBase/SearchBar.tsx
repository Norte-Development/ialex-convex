import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, X } from "lucide-react";
import type { ContentType } from "../../../types/legislation";

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  onClearFilters: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  hasActiveFilters: boolean;
  contentType: ContentType;
}

export function SearchBar({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClearFilters,
  onKeyPress,
  hasActiveFilters,
  contentType,
}: SearchBarProps) {
  const getPlaceholder = () => {
    switch (contentType) {
      case "legislation":
        return "Buscar en la legislación...";
      case "fallos":
        return "Buscar en fallos judiciales...";
      case "all":
        return "Buscar en toda la base de datos...";
      default:
        return "Buscar documentos...";
    }
  };

  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          data-tutorial="database-search"
          placeholder={getPlaceholder()}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyPress={onKeyPress}
          className="pl-10 pr-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-100"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <Button
        onClick={onSearch}
        disabled={!searchQuery.trim() && !hasActiveFilters}
        className="px-6"
      >
        Buscar
      </Button>
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="px-4 bg-transparent"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
