import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Shield, Eye, Calendar, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import TeamMemberPermissionsDialog from "./TeamMemberPermissionsDialog";

interface TeamCasesViewProps {
  teamId: Id<"teams">;
}

type AccessLevel = "none" | "basic" | "advanced" | "admin";

export default function TeamCasesView({ teamId }: TeamCasesViewProps) {
  const { currentCase } = useCase();
  const { can } = usePermissions();
  const canManageTeams = can?.teams?.write || false;

  const casesWithAccess = useQuery(
    api.functions.teams.getCasesAccessibleByTeam,
    { teamId },
  );

  // If we're in a case context, show team members with their permissions
  const teamMembers = useQuery(
    api.functions.permissions.getNewTeamMembersWithCaseAccess,
    currentCase ? { caseId: currentCase._id, teamId } : "skip",
  );

  const getAccessLevelIcon = (level: AccessLevel | "read" | "full") => {
    // Map legacy values to new system
    const normalizedLevel =
      level === "read"
        ? "basic"
        : level === "full"
          ? "admin"
          : (level as AccessLevel);

    switch (normalizedLevel) {
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

  const getAccessLevelText = (level: AccessLevel | "read" | "full") => {
    // Map legacy values to new system
    const normalizedLevel =
      level === "read"
        ? "basic"
        : level === "full"
          ? "admin"
          : (level as AccessLevel);

    switch (normalizedLevel) {
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

  const getAccessLevelColor = (level: AccessLevel | "read" | "full") => {
    // Map legacy values to new system
    const normalizedLevel =
      level === "read"
        ? "basic"
        : level === "full"
          ? "admin"
          : (level as AccessLevel);

    switch (normalizedLevel) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "closed":
        return "Cerrado";
      case "pending":
        return "Pendiente";
      default:
        return status;
    }
  };

  if (!casesWithAccess) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Casos Accesibles</h3>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // If we're in a case context, show team member permissions
  if (currentCase && teamMembers) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Miembros del Equipo</h3>
          <Badge variant="outline">
            {teamMembers.length}{" "}
            {teamMembers.length === 1 ? "miembro" : "miembros"}
          </Badge>
        </div>

        {teamMembers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Este equipo no tiene miembros asignados
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {teamMembers.map((member) => (
              <Card
                key={member.user._id}
                className="hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{member.user.name}</span>
                        <span className="text-sm text-gray-500 capitalize">
                          {member.teamRole}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex items-center gap-2">
                        {member.effectiveAccessLevel ? (
                          <Badge
                            variant="secondary"
                            className={`text-xs flex items-center gap-1 ${getAccessLevelColor(member.effectiveAccessLevel)}`}
                          >
                            {getAccessLevelIcon(member.effectiveAccessLevel)}
                            {getAccessLevelText(member.effectiveAccessLevel)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Sin acceso
                          </Badge>
                        )}

                        <Badge variant="outline" className="text-xs">
                          {member.accessSource === "individual"
                            ? "Individual"
                            : "Equipo"}
                        </Badge>

                        {canManageTeams && (
                          <TeamMemberPermissionsDialog
                            member={{
                              _id: member.user._id,
                              name: member.user.name,
                              email: member.user.email,
                              role: member.teamRole,
                            }}
                            caseId={currentCase._id}
                            teamId={teamId}
                          />
                        )}
                      </div>

                      {(member.individualAccess?.expiresAt ||
                        member.teamAccess?.expiresAt) && (
                        <span className="text-xs text-gray-500">
                          Expira:{" "}
                          {formatDate(
                            (member.individualAccess?.expiresAt ||
                              member.teamAccess?.expiresAt)!,
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default view: show cases accessible by team
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Casos Accesibles</h3>
        <Badge variant="outline">
          {casesWithAccess?.length || 0}{" "}
          {(casesWithAccess?.length || 0) === 1 ? "caso" : "casos"}
        </Badge>
      </div>

      {(casesWithAccess?.length || 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              Este equipo no tiene acceso a ningún caso
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {casesWithAccess?.map((caseItem) => (
            <Card
              key={caseItem._id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base mb-2">
                      <Link
                        to={`/caso/${caseItem._id}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {caseItem.title}
                      </Link>
                    </CardTitle>
                    {caseItem.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {caseItem.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 ${getAccessLevelColor(caseItem.accessLevel)}`}
                    >
                      {getAccessLevelIcon(caseItem.accessLevel)}
                      {getAccessLevelText(caseItem.accessLevel)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getStatusColor(caseItem.status as string)}
                    >
                      {getStatusText(caseItem.status as string)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Creado: {formatDate(caseItem._creationTime as number)}
                    </span>
                  </div>
                  {caseItem.startDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Inicio: {formatDate(caseItem.startDate)}</span>
                    </div>
                  )}
                  {caseItem.tags && caseItem.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {caseItem.tags.slice(0, 3).map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {caseItem.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{caseItem.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
