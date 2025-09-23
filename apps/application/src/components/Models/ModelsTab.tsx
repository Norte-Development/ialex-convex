import { TabsContent } from "../ui/tabs";

import ModelsTable from "./ModelsTable";

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
      <ModelsTable models={models} />
    </TabsContent>
  );
}
