import { Brain } from "lucide-react";

export function WorkPlanEmptyState() {
  return (
    <div className="text-center py-6 text-gray-500">
      <Brain className="h-8 w-8 mx-auto mb-2 text-gray-300" />
      <p className="text-sm">No hay tareas en el plan de trabajo</p>
      <p className="text-xs mt-1">
        Genera un plan con iAlex o agrega tareas manualmente
      </p>
    </div>
  );
}
