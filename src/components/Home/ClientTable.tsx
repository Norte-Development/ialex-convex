import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientTableProps {
  search: string;
}

const ClientTable = ({ search }: ClientTableProps) => {
  console.log("search dentro de ClientTable", search);
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
        <TableRow>
          <TableCell>John Doe Smith</TableCell>
          <TableCell>123456789</TableCell>
          <TableCell className="cursor-pointer">Caso Droga</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

export default ClientTable;
