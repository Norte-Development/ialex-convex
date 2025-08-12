import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Users, Shield, Eye, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface CaseTeamsSummaryProps {
  caseId: Id<"cases">;
}

export default function CaseTeamsSummary({ caseId }: CaseTeamsSummaryProps) {
  const teamsWithAccess = useQuery(api.functions.teams.getTeamsWithCaseAccess, {
    caseId,
  });

  const getAccessLevelIcon = (level: "read" | "full") => {
    return level === "full" ? (
      <Shield className="h-3 w-3 text-blue-600" />
    ) : (
      <Eye className="h-3 w-3 text-gray-600" />
    );
  };

  const getAccessLevelColor = (level: "read" | "full") => {
    return level === "full"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";
  };

  if (!teamsWithAccess) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipos con Acceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fullAccessTeams = teamsWithAccess.filter(
    (team: any) => team.accessLevel === "full",
  );
  const readOnlyTeams = teamsWithAccess.filter(
    (team: any) => team.accessLevel === "read",
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipos con Acceso
          </CardTitle>
          <Badge variant="outline">{teamsWithAccess.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {teamsWithAccess.length === 0 ? (
          <div className="text-center py-4">
            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">
              No hay equipos con acceso a este caso
            </p>
            <Link to={`/caso/${caseId}/equipos`}>
              <Button variant="outline" size="sm">
                Gestionar Equipos
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {fullAccessTeams.length > 0 && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 bg-blue-100 text-blue-800"
                >
                  <Shield className="h-3 w-3" />
                  {fullAccessTeams.length} Completo
                </Badge>
              )}
              {readOnlyTeams.length > 0 && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 bg-gray-100 text-gray-800"
                >
                  <Eye className="h-3 w-3" />
                  {readOnlyTeams.length} Lectura
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {teamsWithAccess.slice(0, 3).map((team) => (
                <div
                  key={team._id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-gray-500" />
                    <span className="font-medium">{team.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs flex items-center gap-1 ${getAccessLevelColor(team.accessLevel)}`}
                  >
                    {getAccessLevelIcon(team.accessLevel)}
                    {team.accessLevel === "full" ? "Completo" : "Lectura"}
                  </Badge>
                </div>
              ))}

              {teamsWithAccess.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1">
                  +{teamsWithAccess.length - 3} equipos más
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <Link to={`/caso/${caseId}/equipos`}>
                <Button variant="outline" size="sm" className="w-full">
                  Ver Todos los Equipos
                  <ArrowRight className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
