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

interface HomeClientTableProps {
  search: string;
}

const HomeClientTable = ({ search }: HomeClientTableProps) => {
  const clientsResult = useQuery(api.functions.clients.getClients, { search });

  const clients = clientsResult?.page || [];

  return (
    <Table>
      <TableHeader className="bg-[#f7f7f7]">
        <TableRow>
          <TableHead>Apellido y nombre</TableHead>
          <TableHead>DNI</TableHead>
          <TableHead>Casos vinculados</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="bg-[#f7f7f7]">
        {clients?.map((client) => (
          <TableRow key={client._id}>
            <TableCell>{client.name}</TableCell>
            <TableCell>{client.dni}</TableCell>
            <TableCell className="cursor-pointer">Caso Droga</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default HomeClientTable;
