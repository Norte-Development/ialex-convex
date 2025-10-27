"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Filter } from "lucide-react";
import type {
  NormativeFilters,
  SortOrder,
  ContentType,
  UnifiedSortBy,
} from "../../../types/legislation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { StaticControls } from "./StaticControls";
import { DataTableContainer } from "./DataTableContainer";
import { DocumentDetails } from "./DocumentDetails";

interface DataBaseTableProps {
  jurisdictions?: string[];
  isInitialLoad?: boolean;
}

interface TableState {
  searchQuery: string;
  debouncedQuery: string;
  isSearchMode: boolean;
  showFilters: boolean;
  filters: NormativeFilters;
  page: number;
  pageSize: number;
  sortBy: UnifiedSortBy;
  sortOrder: SortOrder;
  selectedNormativeId: string | null;
  isDetailsOpen: boolean;
  jurisdiction: string;
  totalResults: number;
  contentType: ContentType;
}

const initialState: TableState = {
  searchQuery: "",
  debouncedQuery: "",
  isSearchMode: false,
  showFilters: false,
  filters: {},
  page: 1,
  pageSize: 25,
  sortBy: "updated_at", // Common to both legislation and fallos
  sortOrder: "desc",
  selectedNormativeId: null,
  isDetailsOpen: false,
  jurisdiction: "all",
  totalResults: 0,
  contentType: "all",
};

export default function DataBaseTable({
  jurisdictions = ["nac"],
}: DataBaseTableProps) {
  const [state, setState] = useState<TableState>(initialState);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const actions = {
    getNormativesFacets: useAction(
      api.functions.legislation.getNormativesFacets,
    ),
    getFallosFacets: useAction(
      api.functions.fallos.getFallosFacets,
    ),
    getNormativeById: useAction(api.functions.legislation.getNormativeById),
    getFallo: useAction(api.functions.fallos.getFallo),
  };

  // Initialize state from URL params
  useEffect(() => {
    const contentType = (searchParams.get("contentType") as ContentType) || "all";
    const jurisdiction = searchParams.get("jurisdiction") || "all";
    
    setState(prev => ({
      ...prev,
      contentType,
      jurisdiction,
    }));
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        debouncedQuery: prev.searchQuery.trim(),
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);

  // Fetch facets for filter options (types, estados, years)
  // This updates based on current filters to show relevant counts
  const { data: normativesFacets } = useQuery({
    queryKey: ["normatives-facets", state.jurisdiction, state.filters, state.contentType],
    queryFn: () => {
      const facetFilters = { ...state.filters };
      // Only add jurisdiction filter if not "all"
      if (state.jurisdiction !== "all") {
        facetFilters.jurisdiccion = state.jurisdiction;
      }
      return actions.getNormativesFacets({
        filters: facetFilters,
      });
    },
    enabled: state.contentType === "legislation" || state.contentType === "all",
    staleTime: 5 * 60 * 1000,
  });

  const { data: fallosFacets } = useQuery({
    queryKey: ["fallos-facets", state.jurisdiction, state.filters, state.contentType],
    queryFn: () => {
      const facetFilters: any = { ...state.filters };
      // Only add jurisdiction filter if not "all"
      if (state.jurisdiction !== "all") {
        facetFilters.jurisdiccion = state.jurisdiction;
      }
      return actions.getFallosFacets({
        filters: facetFilters,
      });
    },
    enabled: state.contentType === "fallos" || state.contentType === "all",
    staleTime: 5 * 60 * 1000,
  });

  // Combine facets for "all" view
  const facets = useMemo(() => {
    if (state.contentType === "legislation") {
      return normativesFacets;
    } else if (state.contentType === "fallos") {
      return fallosFacets;
    } else {
      // "all" - combine facets
      const combinedJurisdicciones = [
        ...(normativesFacets?.jurisdicciones || []),
        ...(fallosFacets?.jurisdicciones || [])
      ];

      const combinedEstados = [
        ...(normativesFacets?.estados || []),
        ...(fallosFacets?.estados || [])
      ];

      // Combine arrays and aggregate counts by name
      const jurisdiccionesMap = new Map<string, number>();
      const estadosMap = new Map<string, number>();

      combinedJurisdicciones.forEach(facet => {
        const current = jurisdiccionesMap.get(facet.name) || 0;
        jurisdiccionesMap.set(facet.name, current + facet.count);
      });

      combinedEstados.forEach(facet => {
        const current = estadosMap.get(facet.name) || 0;
        estadosMap.set(facet.name, current + facet.count);
      });

      return {
        jurisdicciones: Array.from(jurisdiccionesMap.entries()).map(([name, count]) => ({
          name,
          count
        })),
        estados: Array.from(estadosMap.entries()).map(([name, count]) => ({
          name,
          count
        })),
        types: normativesFacets?.tipos || [],
        tribunales: fallosFacets?.tribunales || [],
        materias: fallosFacets?.materias || [],
      };
    }
  }, [normativesFacets, fallosFacets, state.contentType]);


  const handleFilterChange = useCallback(
    (key: keyof NormativeFilters, value: string | boolean | undefined) => {
      setState((prev) => {
        const newFilters = { ...prev.filters };
        if (value === "" || value === undefined || value === false) {
          delete newFilters[key];
        } else {
          (newFilters as any)[key] = value;
        }
        return { ...prev, filters: newFilters, page: 1 };
      });
    },
    [],
  );

  const handleContentTypeChange = useCallback((contentType: ContentType) => {
    setState((prev) => ({
      ...prev,
      contentType,
      page: 1,
      filters: {},
      searchQuery: "",
      debouncedQuery: "",
      // Keep jurisdiction when switching content types
    }));
    
    // Update URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("contentType", contentType);
    setSearchParams(newSearchParams);
  }, [searchParams, setSearchParams]);

  const handleJurisdictionChange = useCallback((jurisdiction: string) => {
    setState((prev) => ({
      ...prev,
      jurisdiction,
      page: 1,
      filters: {},
      searchQuery: "",
      debouncedQuery: "",
    }));
    
    // Update URL
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("jurisdiction", jurisdiction);
    setSearchParams(newSearchParams);
  }, [searchParams, setSearchParams]);

  const clearFilters = useCallback(() => {
    setState(initialState);
  }, []);

  const handleSearch = useCallback(() => {
    setState((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const handleRowClick = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedNormativeId: id,
      isDetailsOpen: true,
    }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setState((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleTotalResultsChange = useCallback((total: number) => {
    setState((prev) => ({ ...prev, totalResults: total }));
  }, []);

  const hasActiveFilters =
    Object.keys(state.filters).length > 0 || state.searchQuery;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Base de Datos Legislativa
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {state.jurisdiction === "all"
              ? "Todas las Jurisdicciones"
              : state.jurisdiction === "nac"
                ? "Nacional"
                : state.jurisdiction.charAt(0).toUpperCase() +
                  state.jurisdiction.slice(1)}{" "}
            • {state.totalResults}{" "}
            {state.totalResults === 1 ? "resultado" : "resultados"}
            {state.debouncedQuery && (
              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                Modo búsqueda
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            setState((prev) => ({ ...prev, showFilters: !prev.showFilters }))
          }
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

      <StaticControls
        searchQuery={state.searchQuery}
        onSearchQueryChange={(query) =>
          setState((prev) => ({ ...prev, searchQuery: query }))
        }
        onSearch={handleSearch}
        onClearFilters={clearFilters}
        onKeyPress={handleKeyPress}
        hasActiveFilters={!!hasActiveFilters}
        jurisdiction={state.jurisdiction}
        jurisdictions={jurisdictions}
        onJurisdictionChange={handleJurisdictionChange}
        contentType={state.contentType}
        onContentTypeChange={handleContentTypeChange}
        isSearchMode={!!state.debouncedQuery}
        sortBy={state.sortBy}
        sortOrder={state.sortOrder}
        pageSize={state.pageSize}
        onSortChange={(sortBy, sortOrder) => {
          setState((prev) => ({
            ...prev,
            sortBy: sortBy as UnifiedSortBy,
            sortOrder: sortOrder as SortOrder,
            page: 1,
          }));
        }}
        onPageSizeChange={(pageSize) =>
          setState((prev) => ({ ...prev, pageSize, page: 1 }))
        }
        showFilters={state.showFilters}
        onShowFiltersChange={(show) =>
          setState((prev) => ({ ...prev, showFilters: show }))
        }
        filters={state.filters}
        onFilterChange={handleFilterChange}
        facets={facets}
        onRemoveFilter={(key) => handleFilterChange(key, undefined)}
        onClearSearch={() =>
          setState((prev) => ({ ...prev, searchQuery: "", debouncedQuery: "" }))
        }
      />

      <DataTableContainer
        jurisdiction={state.jurisdiction}
        filters={state.filters}
        debouncedQuery={state.debouncedQuery}
        page={state.page}
        pageSize={state.pageSize}
        sortBy={state.sortBy}
        sortOrder={state.sortOrder}
        isSearchMode={!!state.debouncedQuery}
        searchQuery={state.searchQuery}
        contentType={state.contentType}
        onRowClick={handleRowClick}
        onPageChange={handlePageChange}
        onTotalResultsChange={handleTotalResultsChange}
      />

      {/* Details Sheet */}
      <Sheet
        open={state.isDetailsOpen}
        onOpenChange={(open) =>
          setState((prev) => ({ ...prev, isDetailsOpen: open }))
        }
      >
        <SheetContent className="w-full sm:max-w-2xl border-l border-gray-200 bg-white rounded-l-lg transition-all duration-300 ease-in-out">
          <SheetHeader>
            <SheetTitle>
              {state.contentType === "fallos" 
                ? "Detalle del fallo" 
                : state.contentType === "legislation"
                ? "Detalle de normativa"
                : "Detalle del documento"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {state.selectedNormativeId && (
              <DocumentDetails
                jurisdiction={state.jurisdiction}
                id={state.selectedNormativeId}
                contentType={state.contentType}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
