import React, { memo, useCallback, useMemo, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useQuery } from "@tanstack/react-query"
import { AppSkeleton } from "../Skeletons"
import { FileText } from "lucide-react"
import type { Estado, NormativeFilters, SortBy, SortOrder } from "../../../types/legislation"
import { TableView } from "./TableView"
import { PaginationControls } from "./PaginationControls"

interface DataTableContainerProps {
  // Data-related state
  jurisdiction: string
  filters: NormativeFilters
  debouncedQuery: string
  page: number
  pageSize: number
  sortBy: SortBy
  sortOrder: SortOrder
  isSearchMode: boolean
  searchQuery: string

  // Callbacks
  onRowClick: (id: string) => void
  onPageChange: (newPage: number) => void
  onTotalResultsChange?: (total: number) => void
}

export const DataTableContainer = memo(function DataTableContainer({
  jurisdiction,
  filters,
  debouncedQuery,
  page,
  pageSize,
  sortBy,
  sortOrder,
  isSearchMode,
  searchQuery,
  onRowClick,
  onPageChange,
  onTotalResultsChange,
}: DataTableContainerProps) {
  const actions = {
    getNormatives: useAction(api.functions.legislation.getNormatives),
  }

  const {
    data: normativesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "getNormatives",
      jurisdiction,
      filters,
      debouncedQuery,
      page,
      pageSize,
      sortBy,
      sortOrder,
    ],
    queryFn: () => {
      const queryFilters = { ...filters }
      
      // Only add jurisdiction filter if not "all"
      if (jurisdiction !== "all") {
        queryFilters.jurisdiccion = jurisdiction
      }

      // Add search query to filters if present
      if (debouncedQuery.trim()) {
        queryFilters.search = debouncedQuery.trim()
      }

      return actions.getNormatives({
        filters: queryFilters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sortBy,
        sortOrder,
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

  // Notify parent of total results changes
  useEffect(() => {
    if (onTotalResultsChange && !computedData.isLoading) {
      onTotalResultsChange(computedData.totalResults)
    }
  }, [computedData.totalResults, computedData.isLoading, onTotalResultsChange])

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

  const totalPages = Math.max(1, Math.ceil(computedData.totalResults / pageSize))

  return (
    <>
      <TableView
        items={computedData.items}
        isSearchMode={isSearchMode}
        onRowClick={onRowClick}
        getEstadoBadgeColor={getEstadoBadgeColor}
        formatDate={formatDate}
      />

      <PaginationControls
        totalResults={computedData.totalResults}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        isSearchMode={isSearchMode}
        searchQuery={searchQuery}
        onPageChange={onPageChange}
      />
    </>
  )
})
