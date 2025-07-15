import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const documents = [
  {
    title: "Demanda por Incumplimiento de Contrato",
    category: "Derecho Civil",
    description: "Modelo de demanda para casos de incumplimiento contractual.",
  },
  {
    title: "Contrato de Arrendamiento Comercial",
    category: "Derecho Mercantil",
    description: "Plantilla de contrato de alquiler para locales comerciales.",
  },
  {
    title: "Acuerdo de Confidencialidad (NDA)",
    category: "Propiedad Intelectual",
    description:
      "Acuerdo para proteger información sensible compartida entre partes.",
  },
  {
    title: "Poder Notarial General",
    category: "Derecho Notarial",
    description:
      "Documento para otorgar a otra persona la facultad de actuar en su nombre.",
  },
  {
    title: "Testamento Abierto",
    category: "Derecho de Sucesiones",
    description:
      "Modelo de testamento para la disposición de bienes post-mortem.",
  },
];

export default function DataBaseTable() {
  return (
    <Table className="bg-white">
      <TableHeader className="bg-gray-200 border-b border-gray-300">
        <TableRow>
          <TableHead>Titulo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Descripcion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc, index) => (
          <TableRow key={index}>
            <TableCell>{doc.title}</TableCell>
            <TableCell>{doc.category}</TableCell>
            <TableCell>{doc.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
