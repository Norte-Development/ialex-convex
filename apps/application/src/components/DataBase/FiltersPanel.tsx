import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { FileText, Calendar, Scale, Users } from "lucide-react";
import { Collapsible, CollapsibleContent } from "../ui/collapsible";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type {
  NormativeFilters,
  Estado,
  Subestado,
  TipoDetalle,
  ContentType,
} from "../../../types/legislation";

interface FiltersPanelProps {
  showFilters: boolean;
  onShowFiltersChange: (show: boolean) => void;
  filters: NormativeFilters;
  onFilterChange: (
    key: keyof NormativeFilters,
    value: string | boolean | undefined,
  ) => void;
  contentType: ContentType;
  facets?: {
    types?: Array<{ name: string; count: number }>;
    jurisdicciones?: Array<{ name: string; count: number }>;
    jurisdicciones_detalle?: Array<{ name: string; count: number }>;
    estados?: Array<{ name: string; count: number }>;
    subestados?: Array<{ name: string; count: number }>;
    tipos_detalle?: Array<{ name: string; count: number }>;
    tribunales?: Array<{ name: string; count: number }>;
    materias?: Array<{ name: string; count: number }>;
  };
}

const estadoOptions: Estado[] = [
  "vigente",
  "derogada",
  "caduca",
  "anulada",
  "suspendida",
  "abrogada",
  "sin_registro_oficial",
];

const subestadoOptions: Subestado[] = [
  "alcance_general",
  "individual_modificatoria_o_sin_eficacia",
  "vetada",
  "derogada",
  "abrogada_implicita",
  "ley_caduca",
  "refundida_ley_caduca",
  "sin_registro",
];

// Mapping table: Estado -> Subestados habilitados
const estadoSubestadoMapping: Record<Estado, Subestado[]> = {
  vigente: ["alcance_general", "individual_modificatoria_o_sin_eficacia"],
  anulada: ["vetada"],
  derogada: ["derogada"],
  abrogada: ["abrogada_implicita"],
  caduca: ["ley_caduca", "refundida_ley_caduca"],
  sin_registro_oficial: ["sin_registro"],
  suspendida: [], // No subestados específicos según la tabla
};

// Mapping table: Tipo General -> Tipo Detalle patterns
// Since tipo_detalle values are dynamic from MongoDB, we use pattern matching
const tipoGeneralDetalleMapping: Record<string, (detalle: string) => boolean> = {
  Ley: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("ley") ||
      lowerDetalle.includes("decreto ley") ||
      lowerDetalle.includes("tratado") ||
      lowerDetalle.includes("código") ||
      lowerDetalle.includes("codigo") ||
      lowerDetalle.includes("constitución") ||
      lowerDetalle.includes("constitucion") ||
      lowerDetalle.includes("texto ordenado ley") ||
      lowerDetalle.includes("ley de contrato de trabajo") ||
      lowerDetalle.includes("ley de procedimientos administrativos") ||
      lowerDetalle.includes("norma jurídica de hecho") ||
      lowerDetalle.includes("norma juridica de hecho")
    );
  },
  Decreto: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("decreto") &&
      !lowerDetalle.includes("decreto ley") &&
      (lowerDetalle.includes("dnu") ||
        lowerDetalle.includes("decreto de necesidad y urgencia") ||
        lowerDetalle.includes("decreto ordenanza") ||
        lowerDetalle.includes("texto ordenado decreto"))
    );
  },
  Resolución: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("resolución") ||
      lowerDetalle.includes("resolucion") ||
      lowerDetalle.includes("resol.")
    );
  },
  Decisión: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("decisión") ||
      lowerDetalle.includes("decision") ||
      lowerDetalle.includes("mercosur")
    );
  },
  Disposición: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return (
      lowerDetalle.includes("disposición") ||
      lowerDetalle.includes("disposicion") ||
      lowerDetalle.includes("técnico registral") ||
      lowerDetalle.includes("tecnico registral")
    );
  },
  Acordada: (detalle: string) => {
    const lowerDetalle = detalle.toLowerCase();
    return lowerDetalle.includes("acordada");
  },
};

export function FiltersPanel({
  showFilters,
  onShowFiltersChange,
  filters,
  onFilterChange,
  contentType,
  facets,
}: FiltersPanelProps) {
  // Fetch tipo_detalle values dynamically
  const getTipoDetalleValues = useAction(
    api.functions.legislation.getTipoDetalleValues,
  );

  const getTipoGeneralValues = useAction(
    api.functions.legislation.getTipoGeneralValues,
  );

  const { data: tipoDetalleOptions = [] } = useQuery({
    queryKey: ["tipo-detalle-values"],
    queryFn: () => getTipoDetalleValues({}),
    enabled: contentType === "legislation" || contentType === "all",
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - same as backend cache
  });

  const { data: tipoGeneralOptions = [] } = useQuery({
    queryKey: ["tipo-general-values"],
    queryFn: () => getTipoGeneralValues({}),
    enabled: contentType === "legislation" || contentType === "all",
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - same as backend cache
  });

  // Filter subestado options based on selected estado
  const filteredSubestadoOptions = useMemo(() => {
    if (!filters.estado) {
      return [];
    }
    const allowedSubestados = estadoSubestadoMapping[filters.estado] || [];
    return subestadoOptions.filter((subestado) =>
      allowedSubestados.includes(subestado),
    );
  }, [filters.estado]);

  // Filter tipo_detalle options based on selected tipo_general
  const filteredTipoDetalleOptions = useMemo(() => {
    if (!filters.tipo_general || !tipoDetalleOptions.length) {
      return [];
    }
    const matcher = tipoGeneralDetalleMapping[filters.tipo_general];
    if (!matcher) {
      // If no specific matcher, return all options (fallback)
      return tipoDetalleOptions;
    }
    return tipoDetalleOptions.filter((detalle) => matcher(detalle));
  }, [filters.tipo_general, tipoDetalleOptions]);

  // Clear subestado when estado changes and current subestado is invalid
  // Also set default sin_registro for sin_registro_oficial if no subestado selected
  useEffect(() => {
    if (filters.estado && filters.subestado) {
      const allowedSubestados = estadoSubestadoMapping[filters.estado] || [];
      if (!allowedSubestados.includes(filters.subestado)) {
        // If estado is sin_registro_oficial, default to sin_registro
        if (filters.estado === "sin_registro_oficial") {
          onFilterChange("subestado", "sin_registro");
        } else {
          onFilterChange("subestado", undefined);
        }
      }
    } else if (filters.estado === "sin_registro_oficial" && !filters.subestado) {
      // Default to sin_registro when estado is sin_registro_oficial and no subestado selected
      onFilterChange("subestado", "sin_registro");
    } else if (!filters.estado && filters.subestado) {
      // Clear subestado if estado is cleared
      onFilterChange("subestado", undefined);
    }
  }, [filters.estado, filters.subestado, onFilterChange]);

  // Clear tipo_detalle when tipo_general changes and current tipo_detalle is invalid
  useEffect(() => {
    if (filters.tipo_general && filters.tipo_detalle) {
      const matcher = tipoGeneralDetalleMapping[filters.tipo_general];
      if (matcher && !matcher(filters.tipo_detalle)) {
        onFilterChange("tipo_detalle", undefined);
      }
    } else if (!filters.tipo_general && filters.tipo_detalle) {
      // Clear tipo_detalle if tipo_general is cleared
      onFilterChange("tipo_detalle", undefined);
    }
  }, [filters.tipo_general, filters.tipo_detalle, onFilterChange]);
  
  return (
    <Collapsible open={showFilters} onOpenChange={onShowFiltersChange}>
      <CollapsibleContent className="mt-6">
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200"
          data-tutorial="database-filters"
        >
          {/* Estado filter - only for legislation */}
          {(contentType === "legislation" || contentType === "all") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <Select
                value={filters.estado || ""}
                onValueChange={(value) =>
                  onFilterChange(
                    "estado",
                    value === "all" ? undefined : (value as Estado),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {estadoOptions.map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estado.charAt(0).toUpperCase() +
                        estado.slice(1).replace("_", " ")}
                      {(() => {
                        const facet = facets?.estados?.find(
                          (f) => f.name === estado,
                        );
                        return facet ? (
                          <span className="text-gray-500 ml-1">
                            ({facet.count})
                          </span>
                        ) : null;
                      })()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Desde
            </label>
            <Input
              type="date"
              value={filters.sanction_date_from || ""}
              onChange={(e) =>
                onFilterChange(
                  "sanction_date_from",
                  e.target.value || undefined,
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Hasta
            </label>
            <Input
              type="date"
              value={filters.sanction_date_to || ""}
              onChange={(e) =>
                onFilterChange("sanction_date_to", e.target.value || undefined)
              }
            />
          </div>

          {/* Legislation-specific filters */}
          {(contentType === "legislation" || contentType === "all") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Tipo General
                </label>
                <Select
                  value={filters.tipo_general || ""}
                  onValueChange={(value) => onFilterChange("tipo_general", value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tipoGeneralOptions.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                        {(() => {
                          const facet = facets?.types?.find((f) => f.name === tipo);
                          return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
                        })()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Tipo Detalle
                </label>
                <Select
                  value={filters.tipo_detalle || ""}
                  onValueChange={(value) =>
                    onFilterChange(
                      "tipo_detalle",
                      value === "all" ? undefined : (value as TipoDetalle),
                    )
                  }
                  disabled={!filters.tipo_general}
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        filters.tipo_general
                          ? "Todos los tipos detalle"
                          : "Seleccione Tipo General primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filteredTipoDetalleOptions.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                        {(() => {
                          const facet = facets?.tipos_detalle?.find(
                            (f) => f.name === tipo,
                          );
                          return facet ? (
                            <span className="text-gray-500 ml-1">
                              ({facet.count})
                            </span>
                          ) : null;
                        })()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Tipo Contenido
                </label>
                <Select
                  value={filters.tipo_contenido || ""}
                  onValueChange={(value) => onFilterChange("tipo_contenido", value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos contenido" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tipoContenidoOptions.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                        {(() => {
                          const facet = facets?.types?.find((f) => f.name === tipo);
                          return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
                        })()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subestado
                </label>
                <Select
                  value={filters.subestado || ""}
                  onValueChange={(value) =>
                    onFilterChange(
                      "subestado",
                      value === "all" ? undefined : (value as Subestado),
                    )
                  }
                  disabled={!filters.estado}
                >
                  <SelectTrigger>
                    <SelectValue 
                      placeholder={
                        filters.estado
                          ? "Todos los subestados"
                          : "Seleccione Estado primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filteredSubestadoOptions.map((subestado) => {
                      const facet = facets?.subestados?.find(
                        (f) => f.name === subestado,
                      );
                      return (
                        <SelectItem key={subestado} value={subestado}>
                          {subestado
                            .charAt(0)
                            .toUpperCase() +
                            subestado
                              .slice(1)
                              .replace(/_/g, " ")}
                          {facet && facet.count > 0 ? (
                            <span className="text-gray-500 ml-1">
                              ({facet.count})
                            </span>
                          ) : null}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="vigencia_actual"
                  checked={filters.vigencia_actual || false}
                  onChange={(e) => onFilterChange("vigencia_actual", e.target.checked || undefined)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="vigencia_actual" className="text-sm font-medium text-gray-700">
                  Solo vigentes
                </label>
              </div> */}
            </>
          )}

          {/* Fallos-specific filters */}
          {(contentType === "fallos" || contentType === "all") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Carátula
                </label>
                <Input
                  type="text"
                  placeholder="Buscar por título/carátula"
                  value={(filters as any).title || ""}
                  onChange={(e) => onFilterChange("title" as any, e.target.value || undefined)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scale className="w-4 h-4 inline mr-1" />
                  Tribunal
                </label>
                <Select
                  value={(filters as any).tribunal || ""}
                  onValueChange={(value) =>
                    onFilterChange(
                      "tribunal" as any,
                      value === "all" ? undefined : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tribunales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(facets?.tribunales || []).map((tribunal) => (
                      <SelectItem key={tribunal.name} value={tribunal.name}>
                        {tribunal.name}
                        <span className="text-gray-500 ml-1">
                          ({tribunal.count})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scale className="w-4 h-4 inline mr-1" />
                  Jurisdicción Detalle
                </label>
                <Select
                  value={(filters as any).jurisdiccion_detalle || ""}
                  onValueChange={(value) =>
                    onFilterChange(
                      "jurisdiccion_detalle" as any,
                      value === "all" ? undefined : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las jurisdicciones detalle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(facets?.jurisdicciones_detalle || []).map((jurisdiccionDetalle) => (
                      <SelectItem key={jurisdiccionDetalle.name} value={jurisdiccionDetalle.name}>
                        {jurisdiccionDetalle.name}
                        <span className="text-gray-500 ml-1">
                          ({jurisdiccionDetalle.count})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Materia
                </label>
                <Select
                  value={(filters as any).materia || ""}
                  onValueChange={(value) =>
                    onFilterChange(
                      "materia" as any,
                      value === "all" ? undefined : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las materias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {(facets?.materias || []).map((materia) => (
                      <SelectItem key={materia.name} value={materia.name}>
                        {materia.name}
                        <span className="text-gray-500 ml-1">
                          ({materia.count})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Actor
                </label>
                <Input
                  type="text"
                  placeholder="Nombre del actor"
                  value={(filters as any).actor || ""}
                  onChange={(e) =>
                    onFilterChange("actor" as any, e.target.value || undefined)
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Demandado
                </label>
                <Input
                  type="text"
                  placeholder="Nombre del demandado"
                  value={(filters as any).demandado || ""}
                  onChange={(e) =>
                    onFilterChange(
                      "demandado" as any,
                      e.target.value || undefined,
                    )
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Magistrados
                </label>
                <Input
                  type="text"
                  placeholder="Nombre de magistrados"
                  value={(filters as any).magistrados || ""}
                  onChange={(e) =>
                    onFilterChange(
                      "magistrados" as any,
                      e.target.value || undefined,
                    )
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scale className="w-4 h-4 inline mr-1" />
                  Sala
                </label>
                <Input
                  type="text"
                  placeholder="Sala del tribunal"
                  value={(filters as any).sala || ""}
                  onChange={(e) =>
                    onFilterChange("sala" as any, e.target.value || undefined)
                  }
                />
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
