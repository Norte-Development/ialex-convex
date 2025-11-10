import CreateCaseDialog from "../components/Cases/CreateCaseDialog";
import { useCase } from "@/context/CaseContext";
import { CaseProvider } from "@/context/CaseContext";
import CasesTableContainer from "../components/Cases/CasesTableContainer";
import { useBillingData, UsageMeter } from "../components/Billing";
import { CasesPageSkeleton } from "../components/Cases/Skeletons";
import { useState, useCallback, useMemo } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Search, Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

function CasesContent() {
  const { currentCase } = useCase();
  const isMobile = useIsMobile();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pendiente" | "en progreso" | "completado" | "archivado" | "cancelado" | undefined>();
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  const { usage, limits } = useBillingData({});

  // Memoized handlers to prevent unnecessary re-renders
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value === "all" ? undefined : value as "pendiente" | "en progreso" | "completado" | "archivado" | "cancelado");
  }, []);

  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleSortOrderChange = useCallback((value: "asc" | "desc") => {
    setSortOrder(value);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter(undefined);
  }, []);

  const hasActiveFilters = useMemo(() => 
    searchQuery.trim() || statusFilter, 
    [searchQuery, statusFilter]
  );

  return (
    <div
      className={`flex flex-col gap-4 w-full min-h-screen px-3 sm:px-5 ${currentCase ? "pt-5" : "pt-20"}`}
    >
      {/* Header - Stack on mobile */}
      <div className="w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Casos</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          {usage && limits && (
            <div className="hidden sm:block sm:w-64">
              <UsageMeter
                used={usage.casesCount}
                limit={limits.cases}
                label="Casos"
                showPercentage={false}
              />
            </div>
          )}
          {/* Show usage meter below title on mobile */}
          {usage && limits && isMobile && (
            <div className="w-full sm:hidden">
              <UsageMeter
                used={usage.casesCount}
                limit={limits.cases}
                label="Casos"
                showPercentage={false}
              />
            </div>
          )}
          <CreateCaseDialog />
        </div>
      </div>

      {/* Search and Filter Controls - Stack on mobile */}
      <div className="w-full flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar casos..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {hasActiveFilters && (
                <span className="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Estado:</label>
              <Select value={statusFilter || "all"} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en progreso">En progreso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="archivado">Archivado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Ordenar por:</label>
              <Select value={sortBy} onValueChange={handleSortByChange}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Fecha creación</SelectItem>
                  <SelectItem value="title">Título</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                  <SelectItem value="priority">Prioridad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Orden:</label>
              <Select value={sortOrder} onValueChange={handleSortOrderChange}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descendente</SelectItem>
                  <SelectItem value="asc">Ascendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="w-full flex justify-start">
        <CasesTableContainer
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          pageSize={20}
        />
      </div>
    </div>
  );
}

export default function CasesPage() {
  return (
    <CaseProvider>
      <CasesContent />
    </CaseProvider>
  );
}