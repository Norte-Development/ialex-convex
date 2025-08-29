import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Badge } from "../ui/badge"
import { Card } from "../ui/card"
import { FileText } from "lucide-react"
import type { NormativeDoc, Estado } from "../../../types/legislation"

interface TableViewProps {
  items: NormativeDoc[]
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
            <TableHead className="font-semibold">Provincia</TableHead>
            <TableHead className="font-semibold">Estado</TableHead>
            <TableHead className="font-semibold">Promulgación</TableHead>
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
            items.map((normative) => (
              <TableRow
                key={normative.id}
                className="cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => onRowClick(normative.id)}
              >
                <TableCell className="font-medium">
                  <div className="max-w-md">
                    <div className="truncate font-medium text-gray-900" title={normative.titulo}>
                      {normative.titulo}
                    </div>
                    {"resumen" in normative && normative.resumen && (
                      <div className="text-xs text-gray-500 truncate mt-1" title={normative.resumen}>
                        {normative.resumen}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium">
                    {normative.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {"numero" in normative ? (normative as NormativeDoc).numero || "-" : "-"}
                </TableCell>
                <TableCell className="capitalize">{normative.provincia || "-"}</TableCell>
                <TableCell>
                  <Badge className={getEstadoBadgeColor(normative.estado as Estado)}>
                    {(normative.estado as Estado).replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{formatDate(normative.promulgacion)}</TableCell>
                <TableCell>
                  {(normative as any).vigencia_actual ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Sí</Badge>
                  ) : (
                    <Badge className="bg-gray-50 text-gray-700 border-gray-200">No</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
