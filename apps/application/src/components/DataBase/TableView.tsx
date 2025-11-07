import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { FileText, Scale } from "lucide-react";
import type {
  NormativeDoc,
  SearchResult,
  Estado,
  ContentType,
  CombinedDocument,
} from "../../../types/legislation";
import type { FalloDoc } from "../../../types/fallos";
import { getJurisdictionName } from "./utils/jurisdictionUtils";

// Type guard to safely check item types
function isNormativeDoc(
  item: NormativeDoc | SearchResult,
): item is NormativeDoc {
  return "document_id" in item;
}

// Type guard to check if item is a fallo
function isFalloDoc(item: CombinedDocument): item is FalloDoc {
  return "tribunal" in item;
}

interface TableViewProps {
  items: CombinedDocument[];
  isSearchMode: boolean;
  searchQuery?: string;
  onRowClick: (id: string) => void;
  getEstadoBadgeColor: (estado: Estado) => string;
  formatDate: (dateString?: string) => string;
  contentType: ContentType;
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
          <TableHead className="font-semibold min-w-0 flex-1">Título</TableHead>
          <TableHead className="font-semibold w-48">Tribunal</TableHead>
          <TableHead className="font-semibold w-32">Jurisdicción</TableHead>
          <TableHead className="font-semibold w-32">Detalle</TableHead>
          <TableHead className="font-semibold w-32">Fecha</TableHead>
        </TableRow>
      );
    } else if (contentType === "legislation") {
      return (
        <TableRow className="bg-gray-50">
          <TableHead className="font-semibold min-w-0 flex-1">Título</TableHead>
          <TableHead className="font-semibold w-32">Tipo</TableHead>
          <TableHead className="font-semibold w-32">Número</TableHead>
          <TableHead className="font-semibold w-32">Jurisdicción</TableHead>
          <TableHead className="font-semibold w-32">Estado</TableHead>
          <TableHead className="font-semibold w-32">Subestado</TableHead>
          <TableHead className="font-semibold w-32">Sanción</TableHead>
        </TableRow>
      );
    } else {
      // "all" - show mixed columns
      return (
        <TableRow className="bg-gray-50">
          <TableHead className="font-semibold min-w-0 flex-1">Título</TableHead>
          <TableHead className="font-semibold w-32">Tipo</TableHead>
          <TableHead className="font-semibold w-32">Jurisdicción</TableHead>
          <TableHead className="font-semibold w-32">Fecha</TableHead>
          <TableHead className="font-semibold w-40">Detalles</TableHead>
        </TableRow>
      );
    }
  };

  return (
    <Card
      className="overflow-hidden shadow-sm"
      data-tutorial="database-results"
    >
      <Table>
        <TableHeader>{getTableHeaders()}</TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  contentType === "fallos"
                    ? 7
                    : contentType === "all"
                      ? 5
                      : 7
                }
                className="text-center py-12"
              >
                <div className="text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">
                    {isSearchMode
                      ? contentType === "fallos"
                        ? "No se encontraron fallos para la búsqueda"
                        : contentType === "legislation"
                          ? "No se encontró legislación para la búsqueda"
                          : "No se encontraron documentos para la búsqueda"
                      : "No se encontraron documentos con los filtros aplicados"}
                  </p>
                  <p className="text-sm mt-1">
                    {isSearchMode
                      ? "Intenta usar términos de búsqueda diferentes"
                      : "Intenta ajustar los filtros"}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const itemId = item.document_id;
              const title =
                (item as FalloDoc).title || (item as NormativeDoc).title;
              const jurisdiccion = item.jurisdiccion;
              const estado = item.estado;

              if (isFalloDoc(item)) {
                // Render fallo row
                if (contentType === "fallos") {
                  return (
                    <TableRow
                      key={itemId}
                      className={`cursor-pointer transition-colors ${
                        isSearchMode
                          ? "hover:bg-yellow-50 border-l-4 border-l-yellow-400"
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div
                            className="truncate font-medium text-gray-900"
                            title={title}
                          >
                            {title}
                          </div>
                          {item.sumario && (
                            <div
                              className="text-xs text-gray-500 truncate mt-1"
                              title={item.sumario}
                            >
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
                      <TableCell>{getJurisdictionName(jurisdiccion)}</TableCell>
                      <TableCell>
                        {item.jurisdiccion_detalle || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(item.date)}
                      </TableCell>
                    </TableRow>
                  );
                } else if (contentType === "all") {
                  // Mixed view for fallos
                  return (
                    <TableRow
                      key={itemId}
                      className={`cursor-pointer transition-colors ${
                        isSearchMode
                          ? "hover:bg-yellow-50 border-l-4 border-l-yellow-400"
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div
                            className="truncate font-medium text-gray-900"
                            title={title}
                          >
                            {title}
                          </div>
                          {item.sumario && (
                            <div
                              className="text-xs text-gray-500 truncate mt-1"
                              title={item.sumario}
                            >
                              {item.sumario}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          FALLO
                        </Badge>
                      </TableCell>
                      <TableCell>{getJurisdictionName(jurisdiccion)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            Tribunal: {item.tribunal}
                          </div>
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
                const resumen = (item as any).resumen;

                // Safely get sanction date
                let sanctionDate: string | undefined;
                if (isNormativeDoc(item)) {
                  sanctionDate =
                    item.dates?.sanction_date ||
                    (item as any).sanction_date ||
                    (item as any).promulgacion;
                } else {
                  sanctionDate = (item as any).sanction_date;
                }

                // Handle timestamp-based dates
                if ((item as any).sanction_ts) {
                  sanctionDate = new Date((item as any).sanction_ts * 1000)
                    .toISOString()
                    .split("T")[0];
                }

                if (contentType === "legislation") {
                  return (
                    <TableRow
                      key={itemId}
                      className={`cursor-pointer transition-colors ${
                        isSearchMode
                          ? "hover:bg-yellow-50 border-l-4 border-l-yellow-400"
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div
                            className="truncate font-medium text-gray-900"
                            title={title}
                          >
                            {title}
                          </div>
                          {resumen && (
                            <div
                              className="text-xs text-gray-500 truncate mt-1"
                              title={resumen}
                            >
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
                      <TableCell>{getJurisdictionName(jurisdiccion)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getEstadoBadgeColor(estado as any)}>
                            {estado.replace("_", " ")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {tipoDetalle && (
                            <Badge variant="outline" className="font-medium">
                              {tipoDetalle}
                            </Badge>
                          )}
                          {(item as any).subestado && (
                            <Badge variant="outline" className="font-medium">
                              {(item as any).subestado}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(sanctionDate)}
                      </TableCell>
                    </TableRow>
                  );
                } else if (contentType === "all") {
                  // Mixed view for legislation
                  return (
                    <TableRow
                      key={itemId}
                      className={`cursor-pointer transition-colors ${
                        isSearchMode
                          ? "hover:bg-yellow-50 border-l-4 border-l-yellow-400"
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => onRowClick(itemId)}
                    >
                      <TableCell className="font-medium">
                        <div className="max-w-md">
                          <div
                            className="truncate font-medium text-gray-900"
                            title={title}
                          >
                            {title}
                          </div>
                          {resumen && (
                            <div
                              className="text-xs text-gray-500 truncate mt-1"
                              title={resumen}
                            >
                              {resumen}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          LEG
                        </Badge>
                      </TableCell>
                      <TableCell>{getJurisdictionName(jurisdiccion)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(sanctionDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600">
                            Tipo: {type}
                            
                          </div>
                          <div className="text-xs text-gray-600">
                            N°: {numero}
                          </div>
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
  );
}
