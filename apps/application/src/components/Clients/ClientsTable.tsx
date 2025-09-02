import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ClientDetailDialog from "./ClientDetailDialog";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface ClientsTableProps {
  clientsResult: any;
  caseId?: Id<"cases">; // If provided, table adapts to case context (hide case count, enable unlink)
}

export default function ClientsTable({
  clientsResult,
  caseId,
}: ClientsTableProps) {
  const removeClientFromCase = useMutation(
    api.functions.cases.removeClientFromCase,
  );

  if (!clientsResult) {
    return <div>Cargando clientes...</div>;
  }

  const clients = clientsResult.page;

  if (!clients || clients.length === 0) {
    return <div>No se encontraron clientes</div>;
  }

  const handleUnlink = async (clientId: Id<"clients">) => {
    if (!caseId) return;
    if (!confirm("¿Desvincular este cliente del caso?")) return;
    try {
      await removeClientFromCase({ clientId, caseId });
    } catch (e) {
      toast.error("Error al desvincular: " + (e as Error).message);
    }
  };

  return (
    <Table className="border border-gray-300 bg-white">
      <TableHeader className="bg-white border border-gray-300">
        <TableRow className="border border-gray-300">
          <TableHead className="border border-gray-300">
            Apellido y nombre
          </TableHead>
          <TableHead className="border border-gray-300">DNI/CUIT</TableHead>
          {!caseId && (
            <TableHead className="border border-gray-300">
              Casos vinculados
            </TableHead>
          )}
          <TableHead className="border border-gray-300 w-[1%] whitespace-nowrap">
            Acciones
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="bg-white border border-gray-300">
        {clients.map((client: any, index: number) => (
          <TableRow
            key={client._id || index}
            className="border border-gray-300"
          >
            <TableCell className="border border-gray-300">
              {client.name}
            </TableCell>
            <TableCell className="border border-gray-300">
              {client.dni || client.cuit || "N/A"}
            </TableCell>
            {!caseId && (
              <TableCell className="cursor-pointer border border-gray-300">
                {client.cases?.length || 0}
              </TableCell>
            )}
            <TableCell className="border border-gray-300 text-right space-x-2 flex-col flex gap-1">
              <ClientDetailDialog clientId={client._id} initialClient={client}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-[12px]  cursor-pointer hover:bg-gray-300"
                >
                  Ver / Editar
                </Button>
              </ClientDetailDialog>

              {caseId && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-[10px] cursor-pointer"
                  onClick={() => handleUnlink(client._id)}
                >
                  Desvincular
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
