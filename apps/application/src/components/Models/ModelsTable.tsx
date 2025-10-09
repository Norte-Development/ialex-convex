import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";

export default function ModelsTable({ models }: any) {
  console.log("Models in ModelsTable:", models);

  return (
    <Table>
      <TableHeader className="bg-gray-100 text-[16px]  py-[16px] px-[8px] text-black ">
        <TableRow>
          <TableCell> </TableCell>
          <TableCell className="text-center font-[500]">Titulo</TableCell>
          <TableCell className="text-center font-[500]">Tipo</TableCell>
          <TableCell className="text-center font-[500]">Enlace</TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!models || models.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
              No hay modelos disponibles
            </TableCell>
          </TableRow>
        ) : (
          models.map((model: any) => (
            <TableRow key={model._id}>
              <TableCell>
                <Checkbox className="h-5 w-5" />
              </TableCell>
              <TableCell className="text-center">
                <span className="font-medium ">{model.title}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={"basic"}>{model.category}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <a href="#" className="text-blue-500 hover:underline">
                  Link
                </a>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
