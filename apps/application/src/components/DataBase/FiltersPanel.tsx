import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { FileText, Calendar, MapPin } from "lucide-react"
import { Collapsible, CollapsibleContent } from "../ui/collapsible"
import type { NormativeFilters, Estado } from "../../../types/legislation"

interface FiltersPanelProps {
  showFilters: boolean
  onShowFiltersChange: (show: boolean) => void
  filters: NormativeFilters
  onFilterChange: (key: keyof NormativeFilters, value: string | boolean | undefined) => void
  jurisdictions: string[]
  jurisdiction: string
  facets?: {
    types?: Record<string, number>
    jurisdicciones?: Record<string, number>
    estados?: Record<string, number>
  }
}

const estadoOptions: Estado[] = [
  "vigente", "derogada", "caduca", "anulada", "suspendida", "abrogada", "sin_registro_oficial"
]

const tipoOptions = [
  "ley",
  "decreto",
  "resolución",
  "disposición",
  "circular",
  "ordenanza",
  "reglamento",
  "acuerdo",
  "declaración",
]

export function FiltersPanel({
  showFilters,
  onShowFiltersChange,
  filters,
  onFilterChange,
  jurisdictions,
  jurisdiction,
  facets,
}: FiltersPanelProps) {
  return (
    <Collapsible
      open={showFilters}
      onOpenChange={onShowFiltersChange}
    >
      <CollapsibleContent className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Tipo
            </label>
            <Select
              value={filters.type || ""}
              onValueChange={(value) => onFilterChange("type", value === "all" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tipoOptions.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                    {facets?.types?.[tipo] && (
                      <span className="text-gray-500 ml-1">({facets.types[tipo]})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Jurisdicción
            </label>
            <Select
              value={filters.jurisdiccion || ""}
              onValueChange={(value) => onFilterChange("jurisdiccion", value === "all" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las jurisdicciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {jurisdictions
                  .filter((j) => j !== jurisdiction)
                  .map((jurisdiccion) => (
                    <SelectItem key={jurisdiccion} value={jurisdiccion}>
                      {jurisdiccion.charAt(0).toUpperCase() + jurisdiccion.slice(1)}
                      {facets?.jurisdicciones?.[jurisdiccion] && (
                        <span className="text-gray-500 ml-1">({facets.jurisdicciones[jurisdiccion]})</span>
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <Select
              value={filters.estado || ""}
              onValueChange={(value) =>
                onFilterChange("estado", value === "all" ? undefined : (value as Estado))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {estadoOptions.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado.charAt(0).toUpperCase() + estado.slice(1).replace("_", " ")}
                    {facets?.estados?.[estado] && (
                      <span className="text-gray-500 ml-1">({facets.estados[estado]})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Desde
            </label>
            <Input
              type="date"
              value={filters.sanction_date_from || ""}
              onChange={(e) => onFilterChange("sanction_date_from", e.target.value || undefined)}
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
              onChange={(e) => onFilterChange("sanction_date_to", e.target.value || undefined)}
            />
          </div>

          <div className="flex items-center space-x-2 pt-6">
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
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
