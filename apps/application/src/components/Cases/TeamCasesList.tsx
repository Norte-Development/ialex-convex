import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Shield, Eye, Calendar, FileText } from "lucide-react";
import { Link } from "react-router-dom";

interface TeamCasesListProps {
  teamId: Id<"teams">;
  casesResult: {
    page: Array<{
      _id: string;
      title: string;
      description?: string;
      status: string;
      accessLevel: "none" | "basic" | "advanced" | "admin";
      _creationTime: number;
      startDate?: number;
      tags?: string[];
    }>;
    isDone: boolean;
    continueCursor: string | null;
    totalCount: number;
  } | undefined;
}

type AccessLevel = "none" | "basic" | "advanced" | "admin";

export default function TeamCasesList({ casesResult }: TeamCasesListProps) {
  const casesWithAccess = casesResult;

  const getAccessLevelIcon = (level: AccessLevel) => {
    return level === "admin" ? (
      <Shield className="h-4 w-4 text-blue-600" />
    ) : (
      <Eye className="h-4 w-4 text-gray-600" />
    );
  };

  const getAccessLevelText = (level: AccessLevel) => {
    switch (level) {
      case "none":
        return "Sin Acceso";
      case "basic":
        return "Acceso Básico";
      case "advanced":
        return "Acceso Avanzado";
      case "admin":
        return "Acceso Administrativo";
      default:
        return "Desconocido";
    }
  };

  const getAccessLevelColor = (level: AccessLevel) => {
    return level === "admin"
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Casos Accesibles</h3>
        <Badge variant="outline">
          {casesWithAccess?.totalCount || 0}{" "}
          {(casesWithAccess?.totalCount || 0) === 1 ? "caso" : "casos"}
        </Badge>
      </div>

      {(casesWithAccess?.totalCount || 0) === 0 ? (
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
          {casesWithAccess?.page?.map((caseItem) => (
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
