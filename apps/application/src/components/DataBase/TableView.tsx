import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Card } from "../ui/card"
import { FileText } from "lucide-react"
import type { NormativeDoc, SearchResult, Estado } from "../../../types/legislation"

// Type guard to safely check item types
function isNormativeDoc(item: NormativeDoc | SearchResult): item is NormativeDoc {
  return 'document_id' in item;
}

interface TableViewProps {
  items: (NormativeDoc | SearchResult)[]
  isSearchMode: boolean
  onRowClick: (id: string) => void
  getEstadoBadgeColor: (estado: Estado) => string
  formatDate: (dateString?: string) => string
}

export function TableView({
  items,
  isSearchMode,
  onRowClick,
  getEstadoBadgeColor,
  formatDate,
}: TableViewProps) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">Título</TableHead>
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Número</TableHead>
            <TableHead className="font-semibold">Jurisdicción</TableHead>
            <TableHead className="font-semibold">Estado</TableHead>
            <TableHead className="font-semibold">Sanción</TableHead>
            <TableHead className="font-semibold">Vigente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">
                    {isSearchMode
                      ? "No se encontraron resultados para la búsqueda"
                      : "No se encontraron normativas con los filtros aplicados"}
                  </p>
                  <p className="text-sm mt-1">Intenta ajustar los filtros o términos de búsqueda</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((normative) => {
              // Safely get the ID for the item
              const itemId = isNormativeDoc(normative) ? normative.document_id : normative.id;

              // Safely get properties that differ between types
              const title = normative.title;
              const type = normative.type;
              const numero = isNormativeDoc(normative) ? normative.numero : undefined;
              const jurisdiccion = normative.jurisdiccion;
              const estado = normative.estado;
              const resumen = normative.resumen;

              // Safely get sanction date
              let sanctionDate: string | undefined;
              if (isNormativeDoc(normative)) {
                sanctionDate = normative.dates?.sanction_date || (normative as any).sanction_date || (normative as any).promulgacion;
              } else {
                sanctionDate = normative.sanction_date;
              }

              // Safely get vigencia_actual
              const vigenciaActual = estado === "vigente" || estado === "sin_registro_oficial";

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
                    <Badge variant="outline" className="font-medium">
                      {type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {numero || "-"}
                  </TableCell>
                  <TableCell className="capitalize">{jurisdiccion || "-"}</TableCell>
                  <TableCell>
                    <Badge className={getEstadoBadgeColor(estado)}>
                      {estado.replace("_", " ")}
                    </Badge>
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
            })
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
