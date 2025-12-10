import CreateCaseDialog from "../components/Cases/CreateCaseDialog";
import { useCase } from "@/context/CaseContext";
import { CaseProvider } from "@/context/CaseContext";
import CasesTableContainer from "../components/Cases/CasesTableContainer";
import { useBillingData, UsageMeter } from "../components/Billing";
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
import ClientFilterDialog from "../components/Cases/ClientFilterDialog";
import { Id } from "../../convex/_generated/dataModel";

function CasesContent() {
  const { currentCase } = useCase();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    | "pendiente"
    | "en progreso"
    | "completado"
    | "archivado"
    | "cancelado"
    | undefined
  >();
  const [selectedClient, setSelectedClient] = useState<{
    id: Id<"clients">;
    name: string;
  } | null>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  const { usage, limits } = useBillingData({});

  // Memoized handlers to prevent unnecessary re-renders
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(
      value === "all"
        ? undefined
        : (value as
            | "pendiente"
            | "en progreso"
            | "completado"
            | "archivado"
            | "cancelado"),
    );
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
    setSelectedClient(null);
  }, []);

  const hasActiveFilters = useMemo(
    () => searchQuery.trim() || statusFilter || selectedClient,
    [searchQuery, statusFilter, selectedClient],
  );

  return (
    <div
      className={`flex flex-col gap-4 w-full min-h-screen px-3 sm:px-5 ${currentCase ? "pt-5" : "pt-16 sm:pt-20"}`}
    >
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Casos</h1>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {usage && limits && (
            <div className="hidden sm:block w-64">
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

      {/* Search and Filter Controls */}
      <div className="w-full flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar casos..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 text-sm sm:text-base"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1 sm:gap-2 shrink-0"
            size="sm"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                !
              </span>
            )}
          </Button>
          <ClientFilterDialog
            selectedClient={selectedClient}
            onSelectClient={setSelectedClient}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="gap-1 sm:gap-2 shrink-0"
              size="sm"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Limpiar</span>
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                Estado:
              </label>
              <Select
                value={statusFilter || "all"}
                onValueChange={handleStatusFilterChange}
              >
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                Ordenar:
              </label>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                Orden:
              </label>
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
          clientId={selectedClient?.id}
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
