import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter, LayoutGrid, List } from "lucide-react";
import { SortOption, ViewMode } from "@/pages/LibraryPage";

interface LibraryFiltersProps {
  typeFilter: string | undefined;
  onTypeFilterChange: (filter: string | undefined) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const TYPE_OPTIONS = [
  { value: undefined, label: "Todos los tipos" },
  { value: "application/pdf", label: "PDFs" },
  { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Documentos Word" },
  { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Hojas de cálculo" },
  { value: "image/", label: "Imágenes" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "lastModified", label: "Última modificación" },
  { value: "name", label: "Nombre" },
  { value: "size", label: "Tamaño" },
  { value: "creationDate", label: "Fecha de creación" },
];

export function LibraryFilters({
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
}: LibraryFiltersProps) {
  const currentTypeLabel =
    TYPE_OPTIONS.find((opt) => opt.value === typeFilter)?.label ||
    "Todos los tipos";
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ||
    "Última modificación";

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            {currentTypeLabel}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {TYPE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.label}
              onClick={() => onTypeFilterChange(option.value)}
              className={typeFilter === option.value ? "bg-accent" : ""}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            {currentSortLabel}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortByChange(option.value)}
              className={sortBy === option.value ? "bg-accent" : ""}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-background p-1">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onViewModeChange("grid")}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onViewModeChange("list")}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

