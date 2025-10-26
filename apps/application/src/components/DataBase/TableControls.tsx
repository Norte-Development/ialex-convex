import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import type { SortBy, SortOrder, ContentType } from "../../../types/legislation"

interface TableControlsProps {
  jurisdiction: string
  jurisdictions: string[]
  onJurisdictionChange: (jurisdiction: string) => void
  isSearchMode: boolean
  sortBy: SortBy
  sortOrder: SortOrder
  pageSize: number
  onSortChange: (sortBy: SortBy | "relevancia", sortOrder: SortOrder) => void
  onPageSizeChange: (pageSize: number) => void
  jurisdictionCounts?: Record<string, number>
  contentType: ContentType
  onContentTypeChange: (contentType: ContentType) => void
}

export function TableControls({
  jurisdiction,
  jurisdictions,
  onJurisdictionChange,
  isSearchMode,
  sortBy,
  sortOrder,
  pageSize,
  onSortChange,
  onPageSizeChange,
  jurisdictionCounts,
  contentType,
  onContentTypeChange,
}: TableControlsProps) {
  const getJurisdictionLabel = (jur: string) => {
    if (jur === "all") return "Todas"
    if (jur === "nac") return "Nacional"
    if (jur === "nacional") return "Nacional"
    return jur.charAt(0).toUpperCase() + jur.slice(1)
  }

  const getJurisdictionLabelWithCount = (jur: string) => {
    const label = getJurisdictionLabel(jur)
    if (jur === "all" || !jurisdictionCounts) return label
    const count = jurisdictionCounts[jur]
    return count !== undefined ? `${label} (${count.toLocaleString()})` : label
  }


  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Tipo de contenido:</span>
        <Select value={contentType} onValueChange={onContentTypeChange}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="legislation">Legislación</SelectItem>
            <SelectItem value="fallos">Fallos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Jurisdicción:</span>
        <Select value={jurisdiction} onValueChange={onJurisdictionChange}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {jurisdictions.map((jur) => (
              <SelectItem key={jur} value={jur}>
                {getJurisdictionLabelWithCount(jur)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Ordenar:</span>
        <Select
          value={isSearchMode ? "relevancia" : sortBy}
          onValueChange={(value) => {
            if (value === "relevancia") {
              onSortChange("relevancia", sortOrder)
            } else {
              onSortChange(value as SortBy, sortOrder)
            }
          }}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevancia">Relevancia</SelectItem>
            {contentType === "legislation" || contentType === "all" ? (
              <>
                <SelectItem value="sanction_date">Sanción</SelectItem>
                <SelectItem value="updated_at">Actualizado</SelectItem>
                <SelectItem value="created_at">Creado</SelectItem>
              </>
            ) : null}
            {contentType === "fallos" || contentType === "all" ? (
              <>
                <SelectItem value="fecha">Fecha del fallo</SelectItem>
                <SelectItem value="promulgacion">Promulgación</SelectItem>
                <SelectItem value="publicacion">Publicación</SelectItem>
                <SelectItem value="updated_at">Actualizado</SelectItem>
                <SelectItem value="created_at">Creado</SelectItem>
              </>
            ) : null}
          </SelectContent>
        </Select>
        {!isSearchMode && (
          <Select
            value={sortOrder}
            onValueChange={(v) => onSortChange(sortBy, v as SortOrder)}
          >
            <SelectTrigger className="w-[120px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">↓ Desc</SelectItem>
              <SelectItem value="asc">↑ Asc</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Por página:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number.parseInt(v, 10))}
        >
          <SelectTrigger className="w-[80px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
