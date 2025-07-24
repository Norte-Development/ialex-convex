import { useCase } from "@/context/CaseContext";
import CaseLayout from "@/components/Cases/CaseLayout";
import TeamAccessDialog from "../../components/Cases/TeamAccessDialog";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Users, Shield, Eye, Plus } from "lucide-react";

export default function CaseTeamsPage() {
  const { currentCase } = useCase();

  const teamsWithAccess = useQuery(
    api.functions.teams.getTeamsWithCaseAccess,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  const getAccessLevelIcon = (level: "read" | "full") => {
    return level === "full" ? (
      <Shield className="h-4 w-4 text-blue-600" />
    ) : (
      <Eye className="h-4 w-4 text-gray-600" />
    );
  };

  const getAccessLevelText = (level: "read" | "full") => {
    return level === "full" ? "Acceso Completo" : "Solo Lectura";
  };

  const getAccessLevelColor = (level: "read" | "full") => {
    return level === "full"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Caso no encontrado</div>
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <div className="space-y-6 min-h-screen pt-10 pl-5 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              Equipos del Caso
            </h1>
            <p className="text-gray-600 mt-1">
              Gestiona qué equipos tienen acceso a este caso
            </p>
          </div>
          <TeamAccessDialog
            caseId={currentCase._id}
            trigger={
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2" />
                Gestionar Acceso
              </Button>
            }
          />
        </div>

        {/* Case Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{currentCase.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Estado</p>
                <Badge
                  variant="outline"
                  className={
                    currentCase.status === "en progreso"
                      ? "bg-green-100 text-green-800"
                      : currentCase.status === "completado"
                        ? "bg-blue-100 text-blue-800"
                        : currentCase.status === "pendiente"
                          ? "bg-yellow-100 text-yellow-800"
                          : currentCase.status === "archivado"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-red-100 text-red-800" // cancelado
                  }
                >
                  {currentCase.status === "en progreso"
                    ? "En Progreso"
                    : currentCase.status === "completado"
                      ? "Completado"
                      : currentCase.status === "pendiente"
                        ? "Pendiente"
                        : currentCase.status === "archivado"
                          ? "Archivado"
                          : "Cancelado"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Creado</p>
                <p className="text-sm">
                  {formatDate(currentCase._creationTime)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Equipos con acceso
                </p>
                <p className="text-sm font-semibold">
                  {teamsWithAccess?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams with Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipos con Acceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamsWithAccess === undefined ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : teamsWithAccess.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5">
                <Users className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay equipos con acceso
                </h3>
                <p className="text-gray-500 text-center mb-4">
                  Otorga acceso a equipos para que puedan colaborar en este
                  caso.
                </p>
                <TeamAccessDialog
                  caseId={currentCase._id}
                  trigger={
                    <Button variant="outline" className="cursor-pointer">
                      <Plus className="h-4 w-4 mr-2 " />
                      Otorgar Acceso
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                {teamsWithAccess.map((team) => (
                  <div
                    key={team._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {team.name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {team.description && <span>{team.description}</span>}
                          {team.description && <span>•</span>}
                          <span>
                            Creado {formatDate(team._creationTime as number)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`flex items-center gap-1 ${getAccessLevelColor(team.accessLevel)}`}
                      >
                        {getAccessLevelIcon(team.accessLevel)}
                        {getAccessLevelText(team.accessLevel)}
                      </Badge>

                      <Badge variant="outline">
                        {team.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <TeamAccessDialog
                    caseId={currentCase._id}
                    trigger={
                      <Button
                        variant="outline"
                        className="w-full cursor-pointer"
                      >
                        <Plus className="h-4 w-4 mr-2 " />
                        Gestionar Más Equipos
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CaseLayout>
  );
}
