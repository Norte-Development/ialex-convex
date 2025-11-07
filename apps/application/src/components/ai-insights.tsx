import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, TrendingUp, Lightbulb } from "lucide-react";
import RecommendationCard from "@/components/Home/RecommendationCard";
import { api } from "../../convex/_generated/api";

export function AIInsights() {
  const navigate = useNavigate();

  // Fetch data for recommendations
  const casesResult = useQuery(api.functions.cases.getCases, {
    paginationOpts: { numItems: 4, cursor: null },
  });
  const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
    days: 7,
    paginationOpts: { numItems: 10, cursor: null },
  });

  const cases = casesResult?.page || [];
  const events = upcomingEvents?.page || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-[#130261] flex items-center justify-center">
          <Lightbulb size={20} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold text-[#130261]">Asistente IA</h2>
      </div>
      <p className="text-sm text-gray-600">
        Recomendaciones personalizadas
      </p>

      <div className="space-y-4">
        {events.length > 0 && (
          <RecommendationCard
            icon={AlertCircle}
            title="Plazos próximos a vencer"
            description={`Tienes ${events.length} evento${events.length > 1 ? "s" : ""} próximo${events.length > 1 ? "s" : ""} en los próximos 7 días`}
            actionText="Ver casos"
            variant="urgent"
            onAction={() => navigate("/eventos")}
          />
        )}
        {cases.length > 0 && (
          <RecommendationCard
            icon={TrendingUp}
            title="Análisis de caso pendiente"
            description={`El caso #${cases[0]?._id.slice(-4)} tiene 3 documentos listos para análisis con IA`}
            actionText="Revisar"
            variant="info"
            onAction={() => navigate(`/caso/${cases[0]?._id}`)}
          />
        )}
        <RecommendationCard
          icon={Lightbulb}
          title="Colabora con tu agente IA"
          description="Abre un caso y chatea con el asistente para generar escritos"
          actionText="Aprender más"
          variant="suggestion"
          onAction={() => navigate("/ai")}
        />
      </div>
    </div>
  );
}

