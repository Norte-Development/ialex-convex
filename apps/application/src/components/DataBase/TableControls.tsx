import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type {
  SortOrder,
  ContentType,
  UnifiedSortBy,
} from "../../../types/legislation";
import { getJurisdictionName } from "./utils/jurisdictionUtils";

interface TableControlsProps {
  jurisdiction: string;
  jurisdictions: string[];
  onJurisdictionChange: (jurisdiction: string) => void;
  isSearchMode: boolean;
  sortBy: UnifiedSortBy;
  sortOrder: SortOrder;
  pageSize: number;
  onSortChange: (sortBy: UnifiedSortBy, sortOrder: SortOrder) => void;
  onPageSizeChange: (pageSize: number) => void;
  jurisdictionCounts?: Array<{ name: string; count: number }>;
  contentType: ContentType;
  onContentTypeChange: (contentType: ContentType) => void;
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
  const getJurisdictionLabelWithCount = (jur: string) => {
    const label = getJurisdictionName(jur);
    if (jur === "all" || !jurisdictionCounts) return label;
    const facet = jurisdictionCounts.find((f) => f.name === jur);
    return facet ? `${label} (${facet.count.toLocaleString()})` : label;
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          Tipo de contenido:
        </span>
        <Select value={contentType} onValueChange={onContentTypeChange}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
              onSortChange("relevancia", sortOrder);
            } else {
              onSortChange(value as UnifiedSortBy, sortOrder);
            }
          }}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevancia">Relevancia</SelectItem>
            {contentType === "legislation" ? (
              <>
                <SelectItem value="sanction_date">Sanción</SelectItem>
                <SelectItem value="updated_at">Actualizado</SelectItem>
                <SelectItem value="created_at">Creado</SelectItem>
              </>
            ) : contentType === "fallos" ? (
              <>
                <SelectItem value="date">Fecha del fallo</SelectItem>
                <SelectItem value="sanction_date">Promulgación</SelectItem>
                <SelectItem value="publication_date">Publicación</SelectItem>
                <SelectItem value="updated_at">Actualizado</SelectItem>
                {/* Legacy options for backward compatibility - hidden but selectable */}
                <SelectItem value="fecha" className="hidden">
                  Fecha (legacy)
                </SelectItem>
                <SelectItem value="promulgacion" className="hidden">
                  Promulgación (legacy)
                </SelectItem>
                <SelectItem value="publicacion" className="hidden">
                  Publicación (legacy)
                </SelectItem>
              </>
            ) : (
              // contentType === "all" - show combined options without duplicates
              <>
                <SelectItem value="sanction_date">
                  Sanción/Promulgación
                </SelectItem>
                <SelectItem value="updated_at">Actualizado</SelectItem>
                <SelectItem value="created_at">Creado</SelectItem>
                <SelectItem value="date">Fecha del fallo</SelectItem>
                <SelectItem value="publication_date">Publicación</SelectItem>
              </>
            )}
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
  );
}
