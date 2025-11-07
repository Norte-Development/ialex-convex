import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Landmark } from "lucide-react";
import { TutorialManager } from "@/components/Tutorial";
import { QuickActions } from "@/components/quick-actions";
import { ClientsList } from "@/components/clients-list";
import EmptyState from "@/components/Home/EmptyState";
import { api } from "../../../convex/_generated/api";
import { Loader } from "@/components/ai-elements/loader";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch data - show more cases on larger screens
  const casesResult = useQuery(api.functions.cases.getCases, {
    paginationOpts: { numItems: 8, cursor: null },
  });
  const totalCases = useQuery(api.functions.stats.getCasesCount);
  const totalClients = useQuery(api.functions.stats.getClientsCount);
  const totalEscritos = useQuery(api.functions.stats.getEscritosCount);

  // Extract data
  const cases = casesResult?.page || [];
  const isLoadingCases = casesResult === undefined;
  const isLoadingStats =
    totalCases === undefined ||
    totalClients === undefined ||
    totalEscritos === undefined;

  if (!user) {
    return null;
  }

  const casesInProgress =
    cases.filter(
      (c) => c.status === "en progreso" || c.status === "pendiente",
    ).length || 0;

  return (
    <>
      <TutorialManager />

      <div className="w-full bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
          {/* Welcome Header */}
          <div className="space-y-2 mt-10">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#130261] text-balance">
                Bienvenido, {user?.name?.split(" ")[0] || "Dr. Martínez"}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-gray-600">
              Tu asistente legal inteligente está listo para ayudarte
            </p>
          </div>

          {/* Quick Actions */}
          <div data-tutorial="home-quick-actions">
            <h2 className="text-lg font-semibold text-[#130261] mb-3">
              Acciones Rápidas
            </h2>
            <QuickActions />
          </div>

          {/* Two Column Layout - Better proportions for large screens */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 lg:gap-6">
            {/* Left Column: Clients List */}
            <div className="xl:col-span-1">
              <ClientsList />
            </div>

            {/* Right Column: Metrics & Overview */}
            <div className="xl:col-span-3 space-y-6">
              {/* Dashboard Metrics */}
              <div>
                <h2 className="text-lg font-semibold text-[#130261] mb-3">
                  Resumen General
                </h2>
                {isLoadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader size={32} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-[#130261]/10 p-4 hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-[#130261] mb-1">
                        {totalCases || 0}
                      </div>
                      <div className="text-xs text-gray-600">Casos Totales</div>
                    </div>
                    <div className="bg-white rounded-lg border border-[#130261]/10 p-4 hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-[#130261] mb-1">
                        {casesInProgress}
                      </div>
                      <div className="text-xs text-gray-600">En Progreso</div>
                    </div>
                    <div className="bg-white rounded-lg border border-[#130261]/10 p-4 hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-[#130261] mb-1">
                        {totalClients || 0}
                      </div>
                      <div className="text-xs text-gray-600">Clientes</div>
                    </div>
                    <div className="bg-white rounded-lg border border-[#130261]/10 p-4 hover:shadow-sm transition-shadow">
                      <div className="text-2xl font-bold text-[#130261] mb-1">
                        {totalEscritos || 0}
                      </div>
                      <div className="text-xs text-gray-600">Escritos</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Cases */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#130261] mb-3">
                    Casos Recientes
                  </h2>
                  <div className="flex items-center justify-end">
                    <button className="text-sm text-[#130261] hover:underline" onClick={() => navigate("/casos")}>Ver todos</button>
                  </div>
                </div>
                {isLoadingCases ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader size={32} />
                  </div>
                ) : cases.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {cases.map((caseItem) => (
                      <div
                        key={caseItem._id}
                        className="bg-white rounded-lg border border-[#130261]/10 p-4 hover:border-[#130261]/30 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => navigate(`/caso/${caseItem._id}`)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm text-[#130261]">
                            {caseItem.title}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {caseItem.status === "en progreso" ||
                            caseItem.status === "pendiente"
                              ? "Activo"
                              : caseItem.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          Última actualización{" "}
                          {caseItem._creationTime
                            ? new Date(caseItem._creationTime).toLocaleDateString(
                                "es-ES",
                                {
                                  day: "numeric",
                                  month: "short",
                                },
                              )
                            : "recientemente"}
                        </p>
                        {caseItem.category && (
                          <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 bg-[#130261]/10 text-[#130261] rounded">
                              {caseItem.category}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Landmark}
                    title="No tienes casos activos"
                    description="Crea tu primer caso para comenzar a gestionar tus expedientes legales"
                    actionText="Crear caso"
                    onAction={() => navigate("/casos")}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
