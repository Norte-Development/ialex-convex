"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useQuery } from "@tanstack/react-query"
import { AppSkeleton } from "../Skeletons"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { Filter, FileText } from "lucide-react"
import type { Estado, NormativeFilters, SortBy, SortOrder } from "../../../types/legislation"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet"
import { SearchBar } from "./SearchBar"
import { TableControls } from "./TableControls"
import { FiltersPanel } from "./FiltersPanel"
import { ActiveFilters } from "./ActiveFilters"
import { TableView } from "./TableView"
import { PaginationControls } from "./PaginationControls"
import { NormativeDetails } from "./NormativeDetails"



interface TableState {
  searchQuery: string
  debouncedQuery: string
  isSearchMode: boolean
  showFilters: boolean
  filters: NormativeFilters
  page: number
  pageSize: number
  sortBy: SortBy
  sortOrder: SortOrder
  selectedNormativeId: string | null
  isDetailsOpen: boolean
  jurisdiction: string
}

const initialState: TableState = {
  searchQuery: "",
  debouncedQuery: "",
  isSearchMode: false,
  showFilters: false,
  filters: {},
  page: 1,
  pageSize: 25,
  sortBy: "sanction_date",
  sortOrder: "desc",
  selectedNormativeId: null,
  isDetailsOpen: false,
  jurisdiction: "nac",
}

export default function DataBaseTable() {
  const [state, setState] = useState<TableState>(initialState)
  const actions = {
    getNormatives: useAction(api.functions.legislation.getNormatives),
    getNormativesFacets: useAction(api.functions.legislation.getNormativesFacets),
    getNormativeById: useAction(api.functions.legislation.getNormativeById),
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, debouncedQuery: prev.searchQuery.trim() }))
    }, 300)
    return () => clearTimeout(timer)
  }, [state.searchQuery])

  // Available jurisdictions - hardcoded for now since we focus on Paraguay
  const jurisdictions = ["nac", "departamental", "municipal"]

  const { data: facets } = useQuery({
    queryKey: ["normatives-facets", state.jurisdiction, state.filters],
    queryFn: () =>
      actions.getNormativesFacets({
        filters: {
          jurisdiccion: state.jurisdiction,
          ...state.filters,
        },
      }),
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: normativesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "getNormatives",
      state.jurisdiction,
      state.filters,
      state.debouncedQuery,
      state.page,
      state.pageSize,
      state.sortBy,
      state.sortOrder,
    ],
    queryFn: () => {
      const filters = {
        jurisdiccion: state.jurisdiction,
        ...state.filters,
      }
      
      // Add search query to filters if present
      if (state.debouncedQuery.trim()) {
        filters.search = state.debouncedQuery.trim()
      }

      return actions.getNormatives({
        filters,
        limit: state.pageSize,
        offset: (state.page - 1) * state.pageSize,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      })
    },
    staleTime: 5 * 60 * 1000,
  })

  const computedData = useMemo(() => {
    const totalResults = normativesData?.pagination?.total || 0
    const items = normativesData?.items || []

    return { 
      totalResults, 
      items, 
      isLoading, 
      error,
      pagination: normativesData?.pagination 
    }
  }, [normativesData, isLoading, error])



  const handleFilterChange = useCallback((key: keyof NormativeFilters, value: string | boolean | undefined) => {
    setState((prev) => {
      const newFilters = { ...prev.filters }
      if (value === "" || value === undefined || value === false) {
        delete newFilters[key]
      } else {
        ;(newFilters as any)[key] = value
      }
      return { ...prev, filters: newFilters, page: 1 }
    })
  }, [])

  const handleJurisdictionChange = useCallback((jurisdiction: string) => {
    setState((prev) => ({
      ...prev,
      jurisdiction,
      page: 1,
      filters: {},
      searchQuery: "",
      debouncedQuery: "",
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setState(initialState)
  }, [])

  const handleSearch = useCallback(() => {
    setState((prev) => ({ ...prev, page: 1 }))
  }, [])

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch()
      }
    },
    [handleSearch],
  )

  const handleRowClick = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedNormativeId: id,
      isDetailsOpen: true,
    }))
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setState((prev) => ({ ...prev, page: newPage }))
  }, [])

  const getEstadoBadgeColor = useCallback((estado: Estado) => {
    const colors = {
      vigente: "bg-emerald-50 text-emerald-700 border-emerald-200",
      derogada: "bg-red-50 text-red-700 border-red-200",
      caduca: "bg-amber-50 text-amber-700 border-amber-200",
      anulada: "bg-gray-50 text-gray-700 border-gray-200",
      suspendida: "bg-orange-50 text-orange-700 border-orange-200",
      abrogada: "bg-purple-50 text-purple-700 border-purple-200",
    }
    return colors[estado as keyof typeof colors] || "bg-blue-50 text-blue-700 border-blue-200"
  }, [])

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString("es-AR")
  }, [])

  if (computedData.isLoading) {
    return <AppSkeleton />
  }

  if (computedData.error) {
    return (
      <div className="flex items-center justify-center p-12 text-red-600 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Error loading legislation</p>
          <p className="text-sm text-red-500 mt-1">{computedData.error.message}</p>
        </div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(computedData.totalResults / state.pageSize))
  const hasActiveFilters = Object.keys(state.filters).length > 0 || state.searchQuery

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Datos Legislativa</h1>
          <p className="text-sm text-gray-600 mt-1">
            {state.jurisdiction === "nac" ? "Nacional" : state.jurisdiction.charAt(0).toUpperCase() + state.jurisdiction.slice(1)} • {computedData.totalResults}{" "}
            {computedData.totalResults === 1 ? "resultado" : "resultados"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setState((prev) => ({ ...prev, showFilters: !prev.showFilters }))}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {Object.keys(state.filters).length + (state.searchQuery ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <SearchBar
            searchQuery={state.searchQuery}
            onSearchQueryChange={(query) => setState((prev) => ({ ...prev, searchQuery: query }))}
            onSearch={handleSearch}
            onClearFilters={clearFilters}
            onKeyPress={handleKeyPress}
            hasActiveFilters={!!hasActiveFilters}
          />

          <TableControls
            jurisdiction={state.jurisdiction}
            jurisdictions={jurisdictions}
            onJurisdictionChange={handleJurisdictionChange}
            isSearchMode={!!state.debouncedQuery}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            pageSize={state.pageSize}
            onSortChange={(sortBy, sortOrder) => {
              setState((prev) => ({ ...prev, sortBy: sortBy as SortBy, sortOrder, page: 1 }))
            }}
            onPageSizeChange={(pageSize) => setState((prev) => ({ ...prev, pageSize, page: 1 }))}
          />

          <FiltersPanel
            showFilters={state.showFilters}
            onShowFiltersChange={(show) => setState((prev) => ({ ...prev, showFilters: show }))}
            filters={state.filters}
            onFilterChange={handleFilterChange}
            jurisdictions={jurisdictions}
            jurisdiction={state.jurisdiction}
            facets={facets}
          />

          <ActiveFilters
            searchQuery={state.searchQuery}
            filters={state.filters}
            onRemoveFilter={(key) => handleFilterChange(key, undefined)}
            onClearSearch={() => setState((prev) => ({ ...prev, searchQuery: "", debouncedQuery: "" }))}
          />
        </CardContent>
      </Card>

      <TableView
        items={computedData.items}
        isSearchMode={!!state.debouncedQuery}
        onRowClick={handleRowClick}
        getEstadoBadgeColor={getEstadoBadgeColor}
        formatDate={formatDate}
      />

      <PaginationControls
        totalResults={computedData.totalResults}
        page={state.page}
        pageSize={state.pageSize}
        totalPages={totalPages}
        isSearchMode={!!state.debouncedQuery}
        searchQuery={state.searchQuery}
        onPageChange={handlePageChange}
      />

      {/* Details Sheet */}
      <Sheet open={state.isDetailsOpen} onOpenChange={(open) => setState((prev) => ({ ...prev, isDetailsOpen: open }))}>
        <SheetContent className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Detalle de normativa</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {state.selectedNormativeId && (
              <NormativeDetails
                jurisdiction={state.jurisdiction}
                id={state.selectedNormativeId}
                getNormativeAction={actions.getNormativeById}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}