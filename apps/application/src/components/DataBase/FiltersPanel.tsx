import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { FileText, Calendar, Scale, Users } from "lucide-react"
import { Collapsible, CollapsibleContent } from "../ui/collapsible"
import type { NormativeFilters, Estado, ContentType } from "../../../types/legislation"

interface FiltersPanelProps {
  showFilters: boolean
  onShowFiltersChange: (show: boolean) => void
  filters: NormativeFilters
  onFilterChange: (key: keyof NormativeFilters, value: string | boolean | undefined) => void
  contentType: ContentType
  facets?: {
    types?: Array<{ name: string; count: number }>
    jurisdicciones?: Array<{ name: string; count: number }>
    estados?: Array<{ name: string; count: number }>
    tribunales?: Array<{ name: string; count: number }>
    materias?: Array<{ name: string; count: number }>
  }
}

const estadoOptions: Estado[] = [
  "vigente", "derogada", "caduca", "anulada", "suspendida", "abrogada", "sin_registro_oficial"
]


export function FiltersPanel({
  showFilters,
  onShowFiltersChange,
  filters,
  onFilterChange,
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
          {/* Estado filter - only for legislation */}
          {(contentType === "legislation" || contentType === "all") && (
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
                      {(() => {
                        const facet = facets?.estados?.find((f) => f.name === estado);
                        return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
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
              {/* <div>
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
              </div> */}

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
                        {(() => {
                          const facet = facets?.types?.find((f) => f.name === tipo);
                          return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
                        })()}
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
                        {(() => {
                          const facet = facets?.types?.find((f) => f.name === tipo);
                          return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
                        })()}
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
                        {(() => {
                          const facet = facets?.estados?.find((f) => f.name === subestado);
                          return facet ? <span className="text-gray-500 ml-1">({facet.count})</span> : null;
                        })()}
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
                  onValueChange={(value) => onFilterChange("tribunal" as any, value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tribunales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(facets?.tribunales || []).map((tribunal) => (
                      <SelectItem key={tribunal.name} value={tribunal.name}>
                        {tribunal.name}
                        <span className="text-gray-500 ml-1">({tribunal.count})</span>
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
                    {(facets?.materias || []).map((materia) => (
                      <SelectItem key={materia.name} value={materia.name}>
                        {materia.name}
                        <span className="text-gray-500 ml-1">({materia.count})</span>
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
