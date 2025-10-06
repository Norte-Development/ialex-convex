import { TabsContent } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";

const myModels = [
  {
    title: "Análisis de Sentimiento para Reseñas de Clientes",
    category: "Procesamiento de Lenguaje Natural",
    description:
      "Un modelo entrenado para clasificar reseñas de productos como positivas, negativas o neutras.",
  },
  {
    title: "Detección de Fraude en Transacciones",
    category: "Análisis Predictivo",
    description:
      "Identifica transacciones potencialmente fraudulentas en tiempo real.",
  },
  {
    title: "Segmentación de Clientes para Marketing",
    category: "Clustering",
    description:
      "Agrupa a los clientes en segmentos con características similares para campañas de marketing dirigidas.",
  },
];

export default function MyModelsTab() {
  return (
    <TabsContent value="Mis Modelos" className="min-w-[90%]">
      <Table>
        <TableHeader className="bg-gray-200 border-b border-gray-300">
          <TableRow>
            <TableHead>Titulo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descripcion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {myModels.map((model, index) => (
            <TableRow key={index}>
              <TableCell>{model.title}</TableCell>
              <TableCell>{model.category}</TableCell>
              <TableCell>{model.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TabsContent>
  );
}
