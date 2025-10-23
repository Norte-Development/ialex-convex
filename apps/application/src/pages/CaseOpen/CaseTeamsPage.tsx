import { useCase } from "@/context/CaseContext";
import CaseLayout from "@/components/Cases/CaseLayout";
import TeamAccessDialog from "../../components/Cases/TeamAccessDialog";
import TeamCasesView from "../../components/Cases/TeamCasesView";
import IndividualUserPermissionsDialog from "../../components/Cases/IndividualUserPermissionsDialog";
import { IndividualUserPermissionsTable } from "../../components/Cases/IndividualUserPermissionsTable";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Users,
  Shield,
  Eye,
  Plus,
  ChevronDown,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { usePermissions } from "@/context/CasePermissionsContext";

type AccessLevel = "none" | "basic" | "advanced" | "admin";

export default function CaseTeamsPage() {
  const { currentCase } = useCase();

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
      <CaseTeamsPageInner />
    </CaseLayout>
  );
}

function CaseTeamsPageInner() {
  const { currentCase } = useCase();
  const { can, hasAccessLevel } = usePermissions();
  const canManageTeams = can?.teams?.write || false;
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const isAdmin = hasAccessLevel("admin");

  if (!currentCase) {
    return null;
  }

  const caseId = currentCase._id;

  const teamsWithAccess = useQuery(api.functions.teams.getTeamsWithCaseAccess, {
    caseId,
  });

  const toggleTeamExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getAccessLevelIcon = (level: AccessLevel) => {
    switch (level) {
      case "admin":
        return <Shield className="h-4 w-4 text-purple-600" />;
      case "advanced":
        return <Shield className="h-4 w-4 text-blue-600" />;
      case "basic":
        return <Eye className="h-4 w-4 text-green-600" />;
      case "none":
        return <Eye className="h-4 w-4 text-gray-400" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAccessLevelText = (level: AccessLevel) => {
    switch (level) {
      case "admin":
        return "Administrador";
      case "advanced":
        return "Acceso Avanzado";
      case "basic":
        return "Acceso Básico";
      case "none":
        return "Sin Acceso";
      default:
        return "Sin Acceso";
    }
  };

  const getAccessLevelColor = (level: AccessLevel) => {
    switch (level) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "advanced":
        return "bg-blue-100 text-blue-800";
      case "basic":
        return "bg-green-100 text-green-800";
      case "none":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 min-h-screen  pl-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Gestion de quipos
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona qué equipos tienen acceso a este caso
          </p>
        </div>
        {isAdmin && (
          <TeamAccessDialog
            caseId={currentCase._id}
            trigger={
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4 " />
                Añadir equipo
              </Button>
            }
          />
        )}
      </div>

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
                Otorga acceso a equipos para que puedan colaborar en este caso.
              </p>
              <TeamAccessDialog
                caseId={caseId}
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
                <div key={team._id} className="border rounded-lg">
                  {/* Team Header */}
                  <div
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => team._id && toggleTeamExpansion(team._id)}
                  >
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {team._id && expandedTeams.has(team._id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
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
                        className={`flex items-center gap-1 ${getAccessLevelColor(team.accessLevel)}`}
                      >
                        {getAccessLevelIcon(team.accessLevel)}
                        {getAccessLevelText(team.accessLevel)}
                      </Badge>

                      <Badge>
                        {team.isActive !== undefined
                          ? team.isActive
                            ? "Activo"
                            : "Inactivo"
                          : "Estado desconocido"}
                      </Badge>
                    </div>
                  </div>

                  {/* Team Members - Expandible */}
                  {team._id && expandedTeams.has(team._id) && (
                    <div className="border-t bg-gray-50 p-4">
                      <TeamCasesView teamId={team._id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual User Permissions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                Usuarios Individuales
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Otorga permisos específicos a usuarios individuales
              </p>
            </div>
            {canManageTeams && (
              <IndividualUserPermissionsDialog
                caseId={caseId}
                trigger={
                  <Button className="cursor-pointer">Añadir Miembro</Button>
                }
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <IndividualUserPermissionsTable caseId={caseId} />
        </CardContent>
      </Card>
    </div>
  );
}
