import { Button } from "@/components/ui/button";
import { CheckSquare, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface KanbanEmptyStateProps {
  caseId: string;
}

export function KanbanEmptyState({ caseId }: KanbanEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-gray-100 p-6 rounded-full mb-6">
        <CheckSquare className="h-12 w-12 text-gray-400" />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No hay tareas en este caso
      </h3>

      <p className="text-gray-500 text-center mb-8 max-w-md">
        Comienza a organizar el trabajo creando tareas manualmente o generando
        un plan con IA.
      </p>

      <div className="flex gap-4">
        <Button
          onClick={() => navigate(`/caso/${caseId}`)}
          variant="outline"
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generar plan con IA
        </Button>

        <Button
          onClick={() => {
            // Abrir diálogo para crear tarea manualmente
            // Esto se conectará con AddTaskDialog existente
            navigate(`/caso/${caseId}`);
          }}
          className="gap-2"
        >
          <CheckSquare className="h-4 w-4" />
          Crear tarea manualmente
        </Button>
      </div>
    </div>
  );
}
