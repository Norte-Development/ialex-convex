import { TabsContent } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";

const models = [
  {
    title: "Modelo de Clasificación de Texto",
    category: "Procesamiento de Lenguaje Natural",
    description: "Clasifica textos en categorías predefinidas.",
  },
  {
    title: "Detector de Objetos en Imágenes",
    category: "Visión por Computadora",
    description: "Identifica y localiza objetos dentro de una imagen.",
  },
  {
    title: "Sistema de Recomendación de Películas",
    category: "Aprendizaje Automático",
    description:
      "Recomienda películas a los usuarios basándose en sus preferencias.",
  },
  {
    title: "Modelo de Predicción de Series Temporales",
    category: "Análisis de Datos",
    description: "Predice valores futuros basados en datos históricos.",
  },
];

export default function ModelsTab() {
  return (
    <TabsContent value="Modelos" className="min-w-[90%]">
      <Table>
        <TableHeader className="bg-gray-200 border-b border-gray-300">
          <TableRow>
            <TableHead>Titulo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descripcion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model, index) => (
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
