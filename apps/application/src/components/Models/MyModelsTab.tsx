import { TabsContent } from "../ui/tabs";

import ModelsTable from "./ModelsTable";

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
      <ModelsTable models={myModels} />
    </TabsContent>
  );
}
