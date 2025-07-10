import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientsTableProps {
  search: string;
}

export default function ClientsTable({ search }: ClientsTableProps) {
  console.log("search dentro de ClientTable", search);
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
        {[...Array(10)].map((_, index) => (
          <TableRow key={index} className="border border-gray-300">
            <TableCell className="border border-gray-300"></TableCell>
            <TableCell className="border border-gray-300"></TableCell>
            <TableCell className="cursor-pointer border border-gray-300"></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
