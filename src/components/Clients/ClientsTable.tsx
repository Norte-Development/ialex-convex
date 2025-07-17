import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface ClientsTableProps {
  search: string;
}

export default function ClientsTable({ search }: ClientsTableProps) {
  const getClients = useQuery(api.functions.clients.getClients, {
    search,
  }) as any;

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
        {getClients?.map((client: any, index: any) => (
          <TableRow key={index} className="border border-gray-300">
            <TableCell className="border border-gray-300">
              {client.name}
            </TableCell>
            <TableCell className="border border-gray-300">
              {client.dni}
            </TableCell>
            <TableCell className="cursor-pointer border border-gray-300">
              {client.cases?.length}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
