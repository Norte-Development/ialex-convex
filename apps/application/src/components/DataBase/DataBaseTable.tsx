import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { AppSkeleton } from "../Skeletons";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Search, Filter, X } from "lucide-react";
import { NormativeDoc, Estado, NormativeFilters } from "../../../types/legislation";

interface DataBaseTableProps {
  jurisdiction: string;
}

export default function DataBaseTable({ jurisdiction }: DataBaseTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NormativeFilters>({});

  // Import legislation functions directly
  const { listNormatives, searchNormatives, getAvailableJurisdictions } = api.functions.legislation;

  // Actions
  const listNormativesAction = useAction(listNormatives);
  const searchNormativesAction = useAction(searchNormatives);
  const getAvailableJurisdictionsAction = useAction(getAvailableJurisdictions);

  // Get jurisdictions for filter options
  const { data: jurisdictions = [] } = useQuery({
    queryKey: ["jurisdictions"],
    queryFn: () => getAvailableJurisdictionsAction({}),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Main query for normatives
  const {
    data: normatives = [],
    isLoading,
    error,
    refetch,
  } = useQuery<NormativeDoc[], Error>({
    queryKey: [
      isSearchMode ? "searchNormatives" : "listNormatives",
      jurisdiction,
      isSearchMode ? searchQuery : filters,
      isSearchMode ? undefined : Object.values(filters).filter(Boolean).length
    ],
    queryFn: () => {
      if (isSearchMode && searchQuery.trim()) {
        return searchNormativesAction({
          jurisdiction,
          query: searchQuery.trim(),
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          limit: 50,
        });
      } else {
        return listNormativesAction({
          jurisdiction,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          limit: 50,
          offset: 0,
        });
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Estado options
  const estadoOptions: Estado[] = [
    "vigente", "derogada", "caduca", "anulada",
    "suspendida", "abrogada", "sin_registro_oficial"
  ];

  // Tipo options (common types)
  const tipoOptions = [
    "ley", "decreto", "resolución", "disposición", "circular",
    "ordenanza", "reglamento", "acuerdo", "declaración"
  ];

  const handleFilterChange = (key: keyof NormativeFilters, value: string | boolean | undefined) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === "" || value === undefined || value === false) {
        delete newFilters[key];
      } else {
        (newFilters as any)[key] = value;
      }
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery("");
    setIsSearchMode(false);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchMode(true);
    } else {
      setIsSearchMode(false);
    }
    refetch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getEstadoBadgeColor = (estado: Estado) => {
    switch (estado) {
      case "vigente": return "bg-green-100 text-green-800";
      case "derogada": return "bg-red-100 text-red-800";
      case "caduca": return "bg-yellow-100 text-yellow-800";
      case "anulada": return "bg-gray-100 text-gray-800";
      case "suspendida": return "bg-orange-100 text-orange-800";
      case "abrogada": return "bg-purple-100 text-purple-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("es-AR");
  };

  if (isLoading) {
    return <AppSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-600">
        Error loading legislation: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            Base de Datos Legislativa - {jurisdiction?.toUpperCase() || "Nacional"}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar en la legislación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={!searchQuery.trim() && !Object.keys(filters).length}>
              Buscar
            </Button>
            {(searchQuery || Object.keys(filters).length > 0) && (
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              {/* Tipo Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <Select
                  value={filters.tipo || ""}
                  onValueChange={(value) => handleFilterChange("tipo", value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tipoOptions.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provincia Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provincia
                </label>
                <Select
                  value={filters.provincia || ""}
                  onValueChange={(value) => handleFilterChange("provincia", value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {jurisdictions
                      .filter(j => j !== "nacional")
                      .map((provincia) => (
                        <SelectItem key={provincia} value={provincia}>
                          {provincia.charAt(0).toUpperCase() + provincia.slice(1)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <Select
                  value={filters.estado || ""}
                  onValueChange={(value) => handleFilterChange("estado", value === "all" ? undefined : (value as Estado))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {estadoOptions.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1).replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Promulgación From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promulgación Desde
                </label>
                <Input
                  type="date"
                  value={filters.promulgacion_from || ""}
                  onChange={(e) => handleFilterChange("promulgacion_from", e.target.value || undefined)}
                />
              </div>

              {/* Promulgación To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promulgación Hasta
                </label>
                <Input
                  type="date"
                  value={filters.promulgacion_to || ""}
                  onChange={(e) => handleFilterChange("promulgacion_to", e.target.value || undefined)}
                />
              </div>

              {/* Vigencia Actual */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="vigencia_actual"
                  checked={filters.vigencia_actual || false}
                  onChange={(e) => handleFilterChange("vigencia_actual", e.target.checked || undefined)}
                  className="rounded"
                />
                <label htmlFor="vigencia_actual" className="text-sm font-medium text-gray-700">
                  Solo Vigentes
                </label>
              </div>
            </div>
          )}

          {/* Active Filters Display */}
          {Object.keys(filters).length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Filtros activos:</span>
              {Object.entries(filters).map(([key, value]) => (
                value && (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                    <button
                      onClick={() => handleFilterChange(key as keyof NormativeFilters, undefined)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </Badge>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Provincia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Promulgación</TableHead>
                <TableHead>Vigente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {normatives.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {isSearchMode
                      ? "No se encontraron resultados para la búsqueda"
                      : "No se encontraron normativas con los filtros aplicados"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                normatives.map((normative) => (
                  <TableRow key={normative.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-md">
                        <div className="truncate" title={normative.titulo}>
                          {normative.titulo}
                        </div>
                        {normative.resumen && (
                          <div className="text-xs text-gray-500 truncate mt-1" title={normative.resumen}>
                            {normative.resumen}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {normative.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>{normative.numero || "-"}</TableCell>
                    <TableCell>{normative.provincia || "-"}</TableCell>
                    <TableCell>
                      <Badge className={getEstadoBadgeColor(normative.estado)}>
                        {normative.estado.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(normative.promulgacion)}</TableCell>
                    <TableCell>
                      {normative.vigencia_actual ? (
                        <Badge className="bg-green-100 text-green-800">Sí</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">No</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 text-center">
        {normatives.length} {normatives.length === 1 ? "resultado" : "resultados"} encontrados
        {isSearchMode && searchQuery && (
          <span> para "{searchQuery}"</span>
        )}
      </div>
    </div>
  );
}
