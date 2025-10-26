import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Card } from "../ui/card"
import { FileText, Scale } from "lucide-react"
import type { NormativeDoc, SearchResult, Estado, ContentType, CombinedDocument } from "../../../types/legislation"
import type { FalloDoc } from "../../../types/fallos"

// Type guard to safely check item types
function isNormativeDoc(item: NormativeDoc | SearchResult): item is NormativeDoc {
  return 'document_id' in item;
}

// Type guard to check if item is a fallo
function isFalloDoc(item: CombinedDocument): item is FalloDoc {
  return 'tribunal' in item && 'actor' in item && 'demandado' in item;
}

interface TableViewProps {
  items: CombinedDocument[]
  isSearchMode: boolean
  onRowClick: (id: string) => void
  getEstadoBadgeColor: (estado: Estado) => string
  formatDate: (dateString?: string) => string
  contentType: ContentType
}

export function TableView({
  items,
  isSearchMode,
  onRowClick,
  getEstadoBadgeColor,
  formatDate,
  contentType,
}: TableViewProps) {
  const getTableHeaders = () => {
    if (contentType === "fallos") {
      return (
        <TableRow className="bg-gray-50">
          <TableHead className="font-semibold">Título</TableHead>
          <TableHead className="font-semibold">Tribunal</TableHead>
          <TableHead className="font-semibold">Jurisdicción</TableHead>
          <TableHead className="font-semibold">Fecha</TableHead>
          <TableHead className="font-semibold">Actor</TableHead>
          <TableHead className="font-semibold">Demandado</TableHead>
          <TableHead className="font-semibold">Estado</TableHead>
        </TableRow>
      );
    } else if (contentType === "legislation") {
  return (
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Título</TableHead>
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Número</TableHead>
            <TableHead className="font-semibold">Jurisdicción</TableHead>
            <TableHead className="font-semibold">Estado</TableHead>
            <TableHead className="font-semibold">Sanción</TableHead>
            <TableHead className="font-semibold">Vigente</TableHead>
          </TableRow>
      );
    } else {
      // "all" - show mixed columns
      return (
        <TableRow className="bg-gray-50">
          <TableHead className="font-semibold">Título</TableHead>
          <TableHead className="font-semibold">Tipo</TableHead>
          <TableHead className="font-semibold">Jurisdicción</TableHead>
          <TableHead className="font-semibold">Fecha</TableHead>
          <TableHead className="font-semibold">Estado</TableHead>
          <TableHead className="font-semibold">Detalles</TableHead>
        </TableRow>
      );
    }
  };

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          {getTableHeaders()}
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={contentType === "all" ? 6 : 7} className="text-center py-12">
                <div className="text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">
                    {isSearchMode
                      ? "No se encontraron resultados para la búsqueda"
                      : "No se encontraron documentos con los filtros aplicados"}
                  </p>
                  <p className="text-sm mt-1">Intenta ajustar los filtros o términos de búsqueda</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const itemId = item.document_id;
              const title = (item as FalloDoc).titulo || (item as NormativeDoc).title;
              const jurisdiccion = item.jurisdiccion;
              const estado = item.estado;

              if (isFalloDoc(item)) {
                // Render fallo row
                if (contentType === "fallos") {
                  return (
                    <TableRow
                      key={itemId}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div className="truncate font-medium text-gray-900" title={title}>
                            {title}
                          </div>
                          {item.sumario && (
                            <div className="text-xs text-gray-500 truncate mt-1" title={item.sumario}>
                              {item.sumario}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          {item.tribunal}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{jurisdiccion || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(item.fecha)}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-32" title={item.actor}>
                        {item.actor || "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-32" title={item.demandado}>
                        {item.demandado || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getEstadoBadgeColor(estado)}>
                          {estado.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                } else if (contentType === "all") {
                  // Mixed view for fallos
                  return (
                    <TableRow
                      key={itemId}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div className="truncate font-medium text-gray-900" title={title}>
                            {title}
                          </div>
                          {item.sumario && (
                            <div className="text-xs text-gray-500 truncate mt-1" title={item.sumario}>
                              {item.sumario}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          <span className="text-xs">Fallo</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{jurisdiccion || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(item.fecha)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getEstadoBadgeColor(estado)}>
                          {estado.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">Tribunal: {item.tribunal}</div>
                          <div className="text-xs text-gray-600">Actor: {item.actor}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
              } else {
                // Render legislation row
                const type = (item as any).tipo_general || (item as any).type;
                const tipoDetalle = (item as any).tipo_detalle;
                const tipoContenido = (item as any).tipo_contenido;
                const numero = (item as any).numero || (item as any).number;
                const subestado = (item as any).subestado;
                const resumen = (item as any).resumen;

              // Safely get sanction date
              let sanctionDate: string | undefined;
                if (isNormativeDoc(item)) {
                  sanctionDate = item.dates?.sanction_date || (item as any).sanction_date || (item as any).promulgacion;
              } else {
                  sanctionDate = (item as any).sanction_date;
              }

              // Handle timestamp-based dates
                if ((item as any).sanction_ts) {
                  sanctionDate = new Date((item as any).sanction_ts * 1000).toISOString().split('T')[0];
              }

              // Safely get vigencia_actual
              const vigenciaActual = estado === "vigente" || estado === "sin_registro_oficial";

                if (contentType === "legislation") {
              return (
                <TableRow
                  key={itemId}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => onRowClick(itemId)}
                >
                  <TableCell className="font-medium">
                    <div className="max-w-md">
                      <div className="truncate font-medium text-gray-900" title={title}>
                        {title}
                      </div>
                      {resumen && (
                        <div className="text-xs text-gray-500 truncate mt-1" title={resumen}>
                          {resumen}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {type && (
                        <Badge variant="outline" className="font-medium">
                          {type}
                        </Badge>
                      )}
                      {tipoDetalle && (
                        <Badge variant="secondary" className="text-xs">
                          {tipoDetalle}
                        </Badge>
                      )}
                      {tipoContenido && (
                        <Badge variant="outline" className="text-xs">
                          {tipoContenido}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {numero || "-"}
                  </TableCell>
                  <TableCell className="capitalize">{jurisdiccion || "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={getEstadoBadgeColor(estado)}>
                        {estado.replace("_", " ")}
                      </Badge>
                      {subestado && (
                        <Badge variant="outline" className="text-xs">
                          {subestado.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDate(sanctionDate)}
                  </TableCell>
                  <TableCell>
                    {vigenciaActual ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Sí</Badge>
                    ) : (
                      <Badge className="bg-gray-50 text-gray-700 border-gray-200">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
                } else if (contentType === "all") {
                  // Mixed view for legislation
                  return (
                    <TableRow
                      key={itemId}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div className="truncate font-medium text-gray-900" title={title}>
                            {title}
                          </div>
                          {resumen && (
                            <div className="text-xs text-gray-500 truncate mt-1" title={resumen}>
                              {resumen}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span className="text-xs">Ley</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{jurisdiccion || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(sanctionDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getEstadoBadgeColor(estado)}>
                          {estado.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">Tipo: {type}</div>
                          <div className="text-xs text-gray-600">N°: {numero}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
              }
              return null;
            })
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
