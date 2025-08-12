import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientsTableProps {
  clientsResult: any;
}

export default function ClientsTable({ clientsResult }: ClientsTableProps) {
  if (!clientsResult) {
    return <div>Cargando clientes...</div>;
  }

  const clients = clientsResult.page;

  if (!clients || clients.length === 0) {
    return <div>No se encontraron clientes</div>;
  }

  return (
    <Table className="border border-gray-300 bg-white">
      <TableHeader className="bg-white border border-gray-300">
        <TableRow className="border border-gray-300">
          <TableHead className="border border-gray-300">
            Apellido y nombre
          </TableHead>
          <TableHead className="border border-gray-300">DNI/CUIT</TableHead>
          <TableHead className="border border-gray-300">
            Casos vinculados
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
            <TableCell className="cursor-pointer border border-gray-300">
              {client.cases?.length || 0}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
