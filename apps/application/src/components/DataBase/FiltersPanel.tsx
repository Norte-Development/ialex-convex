import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { FileText, Calendar, MapPin, Scale, Users } from "lucide-react"
import { Collapsible, CollapsibleContent } from "../ui/collapsible"
import type { NormativeFilters, Estado, Subestado, TipoGeneral, TipoDetalle, TipoContenido, ContentType, CombinedFilters } from "../../../types/legislation"

interface FiltersPanelProps {
  showFilters: boolean
  onShowFiltersChange: (show: boolean) => void
  filters: NormativeFilters
  onFilterChange: (key: keyof NormativeFilters, value: string | boolean | undefined) => void
  jurisdictions: string[]
  jurisdiction: string
  contentType: ContentType
  facets?: {
    types?: Record<string, number>
    jurisdicciones?: Record<string, number>
    estados?: Record<string, number>
    tribunales?: Record<string, number>
    materias?: Record<string, number>
  }
}

const estadoOptions: Estado[] = [
  "vigente", "derogada", "caduca", "anulada", "suspendida", "abrogada", "sin_registro_oficial"
]

const subestadoOptions: Subestado[] = [
  "alcance_general", "individual_modificatoria_o_sin_eficacia", "vetada", "derogada", 
  "abrogada_implicita", "ley_caduca", "refundida_ley_caduca", "sin_registro"
]

const tipoGeneralOptions: TipoGeneral[] = [
  "Ley", "Decreto", "Resolucion", "Ordenanza", "Reglamento"
]

const tipoDetalleOptions: TipoDetalle[] = [
  "Ley", "Decreto", "Resolucion", "Ordenanza", "Reglamento"
]

const tipoContenidoOptions: TipoContenido[] = [
  "leg", "jur", "adm"
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
  contentType,
  facets,
}: FiltersPanelProps) {
  return (
    <Collapsible
      open={showFilters}
      onOpenChange={onShowFiltersChange}
    >
      <CollapsibleContent className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200">
          {/* Common filters - always shown */}
          {/* <div>
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
          </div> */}

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
                        {facets?.types?.[tipo] && (
                          <span className="text-gray-500 ml-1">({facets.types[tipo]})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Tipo Detalle
                </label>
                <Select
                  value={filters.tipo_detalle || ""}
                  onValueChange={(value) => onFilterChange("tipo_detalle", value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos detalle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tipoDetalleOptions.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                        {facets?.types?.[tipo] && (
                          <span className="text-gray-500 ml-1">({facets.types[tipo]})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

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
                        {facets?.types?.[tipo] && (
                          <span className="text-gray-500 ml-1">({facets.types[tipo]})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subestado</label>
                <Select
                  value={filters.subestado || ""}
                  onValueChange={(value) =>
                    onFilterChange("subestado", value === "all" ? undefined : (value as Subestado))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los subestados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {subestadoOptions.map((subestado) => (
                      <SelectItem key={subestado} value={subestado}>
                        {subestado.charAt(0).toUpperCase() + subestado.slice(1).replace("_", " ")}
                        {facets?.estados?.[subestado] && (
                          <span className="text-gray-500 ml-1">({facets.estados[subestado]})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

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
                  <Scale className="w-4 h-4 inline mr-1" />
                  Tribunal
                </label>
                <Select
                  value={(filters as any).tribunal || ""}
                  onValueChange={(value) => onFilterChange("tribunal" as any, value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tribunales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.keys(facets?.tribunales || {}).map((tribunal) => (
                      <SelectItem key={tribunal} value={tribunal}>
                        {tribunal}
                        {facets?.tribunales?.[tribunal] && (
                          <span className="text-gray-500 ml-1">({facets.tribunales[tribunal]})</span>
                        )}
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
                  onValueChange={(value) => onFilterChange("materia" as any, value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las materias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.keys(facets?.materias || {}).map((materia) => (
                      <SelectItem key={materia} value={materia}>
                        {materia}
                        {facets?.materias?.[materia] && (
                          <span className="text-gray-500 ml-1">({facets.materias[materia]})</span>
                        )}
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
                  onChange={(e) => onFilterChange("actor" as any, e.target.value || undefined)}
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
                  onChange={(e) => onFilterChange("demandado" as any, e.target.value || undefined)}
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
                  onChange={(e) => onFilterChange("magistrados" as any, e.target.value || undefined)}
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
                  onChange={(e) => onFilterChange("sala" as any, e.target.value || undefined)}
                />
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
