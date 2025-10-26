import React, { memo } from "react"
import { Card, CardContent } from "../ui/card"
import type { NormativeFilters, SortBy, SortOrder, ContentType } from "../../../types/legislation"
import { SearchBar } from "./SearchBar"
import { TableControls } from "./TableControls"
import { FiltersPanel } from "./FiltersPanel"
import { ActiveFilters } from "./ActiveFilters"

interface StaticControlsProps {
  // Search state
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: () => void
  onClearFilters: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  hasActiveFilters: boolean

  // Jurisdiction state
  jurisdiction: string
  jurisdictions: string[]
  onJurisdictionChange: (jurisdiction: string) => void

  // Content type state
  contentType: ContentType
  onContentTypeChange: (contentType: ContentType) => void

  // Table controls
  isSearchMode: boolean
  sortBy: SortBy
  sortOrder: SortOrder
  pageSize: number
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void
  onPageSizeChange: (pageSize: number) => void

  // Filters state
  showFilters: boolean
  onShowFiltersChange: (show: boolean) => void
  filters: NormativeFilters
  onFilterChange: (key: keyof NormativeFilters, value: string | boolean | undefined) => void
  facets?: any

  // Active filters
  onRemoveFilter: (key: keyof NormativeFilters) => void
  onClearSearch: () => void
}

export const StaticControls = memo(function StaticControls({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClearFilters,
  onKeyPress,
  hasActiveFilters,
  jurisdiction,
  jurisdictions,
  onJurisdictionChange,
  contentType,
  onContentTypeChange,
  isSearchMode,
  sortBy,
  sortOrder,
  pageSize,
  onSortChange,
  onPageSizeChange,
  showFilters,
  onShowFiltersChange,
  filters,
  onFilterChange,
  facets,
  onRemoveFilter,
  onClearSearch,
}: StaticControlsProps) {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardContent className="p-6">
        <SearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onSearch={onSearch}
          onClearFilters={onClearFilters}
          onKeyPress={onKeyPress}
          hasActiveFilters={hasActiveFilters}
        />

        <TableControls
          jurisdiction={jurisdiction}
          jurisdictions={jurisdictions}
          onJurisdictionChange={onJurisdictionChange}
          contentType={contentType}
          onContentTypeChange={onContentTypeChange}
          isSearchMode={isSearchMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          pageSize={pageSize}
          onSortChange={onSortChange}
          onPageSizeChange={onPageSizeChange}
          jurisdictionCounts={facets?.jurisdicciones}
        />

        <FiltersPanel
          showFilters={showFilters}
          onShowFiltersChange={onShowFiltersChange}
          filters={filters}
          onFilterChange={onFilterChange}
          jurisdictions={jurisdictions}
          jurisdiction={jurisdiction}
          contentType={contentType}
          facets={facets}
        />

        <ActiveFilters
          searchQuery={searchQuery}
          filters={filters}
          onRemoveFilter={onRemoveFilter}
          onClearSearch={onClearSearch}
        />
      </CardContent>
    </Card>
  )
})
