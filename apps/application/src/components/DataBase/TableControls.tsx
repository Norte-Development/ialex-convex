import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import type { SortBy, SortOrder } from "../../../types/legislation"

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
}: TableControlsProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Jurisdicción:</span>
        <Select value={jurisdiction} onValueChange={onJurisdictionChange}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {jurisdictions.map((jurisdiction) => (
              <SelectItem key={jurisdiction} value={jurisdiction}>
                {jurisdiction === "nacional" ? "Nacional" : jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1)}
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
            <SelectItem value="sanction_date">Sanción</SelectItem>
            <SelectItem value="updated_at">Actualizado</SelectItem>
            <SelectItem value="created_at">Creado</SelectItem>
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
