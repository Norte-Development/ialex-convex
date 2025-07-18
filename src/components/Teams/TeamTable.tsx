import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export default function TeamTable() {
  return (
    <Table className="bg-white">
      <TableHeader className="border border-gray-300">
        <TableRow>
          <TableHead className="border border-gray-300 text-center">
            Integrante
          </TableHead>
          <TableHead className="border border-gray-300 text-center">
            Mail
          </TableHead>
          <TableHead className="border border-gray-300 text-center">
            Rol
          </TableHead>
          <TableHead className="border border-gray-300 text-center">
            Asignado
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="border border-gray-300 text-center">
            Juan Manuel
          </TableCell>
          <TableCell className="border border-gray-300 text-center">
            juanmanuel@gmail.com
          </TableCell>
          <TableCell className="border border-gray-300 text-center">
            <Select>
              <SelectTrigger className="w-full bg-gray-900 text-white placeholder:text-white">
                <SelectValue
                  placeholder="Seleccionar"
                  className="placeholder:text-white"
                />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 text-white">
                <SelectItem value="1">Secretario</SelectItem>
                <SelectItem value="2">Abogado</SelectItem>
                <SelectItem value="3">Admnistrador</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="border border-gray-300 text-center">
            Caso 1
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
