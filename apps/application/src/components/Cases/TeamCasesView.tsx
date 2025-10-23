import { useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Shield, Eye, Users } from "lucide-react";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import TeamMemberPermissionsDialog from "./TeamMemberPermissionsDialog";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { PaginationControls } from "../ui/pagination-controls";

interface TeamCasesViewProps {
  teamId: Id<"teams">;
}

type AccessLevel = "none" | "basic" | "advanced" | "admin";

export default function TeamCasesView({ teamId }: TeamCasesViewProps) {
  const { currentCase } = useCase();
  const { can } = usePermissions();
  const canManageTeams = can?.teams?.write || false;
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const casesWithAccess = useQuery(
    api.functions.teams.getCasesAccessibleByTeam,
    { 
      teamId,
      paginationOpts: {
        numItems: pageSize,
        cursor: ((currentPage - 1) * pageSize).toString()
      }
    },
  );

  // If we're in a case context, show team members with their permissions
  const teamMembers = useQuery(
    api.functions.teams.getTeamMembersWithCaseAccess,
    currentCase ? { caseId: currentCase._id, teamId } : "skip",
  );

  // Pagination handler
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when teamId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [teamId]);

  // Filter team members based on search query
  const filteredMembers = teamMembers?.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.user.name?.toLowerCase().includes(query) ||
      member.user.email?.toLowerCase().includes(query) ||
      member.teamRole?.toLowerCase().includes(query)
    );
  });

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
        <div className="flex items-center justify-between mb-4">
          <Input
            placeholder="Buscar por nombre, email o rol..."
            className="w-[300px] h-[32px] placeholder:text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span className="text-sm text-gray-500">
              {filteredMembers?.length} de {teamMembers.length} miembros
            </span>
          )}
        </div>

        {teamMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              Este equipo no tiene miembros asignados
            </p>
          </div>
        ) : filteredMembers && filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              No se encontraron miembros que coincidan con "{searchQuery}"
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F5F5F5]">
              <TableRow>
                <TableHead>
                  <Checkbox />
                </TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol </TableHead>
                <TableHead>Email</TableHead>
                {canManageTeams && <TableHead>Permisos</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers?.map((member) => (
                <TableRow key={member.user._id}>
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {member.user.name}
                          {user?._id === member.user._id && (
                            <span className="text-sm text-gray-500 ml-1">
                              (Vos)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="capitalize">{member.teamRole}</Badge>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-black">
                      {member.user.email}
                    </span>
                  </TableCell>
                  {canManageTeams && (
                    <TableCell>
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Casos Accesibles</h3>
        <Badge variant="outline">
          {casesWithAccess?.totalCount || 0}{" "}
          {(casesWithAccess?.totalCount || 0) === 1 ? "caso" : "casos"}
        </Badge>
      </div>

      {(casesWithAccess?.totalCount || 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">
            Este equipo no tiene acceso a ningún caso
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader className="bg-[#F5F5F5]">
              <TableRow>
                <TableHead>Caso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Nivel de Acceso</TableHead>
                <TableHead>Fecha de Creación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {casesWithAccess?.page?.map((caseItem) => (
                <TableRow key={caseItem._id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium hover:text-blue-600 transition-colors cursor-pointer">
                        {caseItem.title}
                      </span>
                      {caseItem.description && (
                        <span className="text-sm text-gray-500 line-clamp-1">
                          {caseItem.description}
                        </span>
                      )}
                      {caseItem.tags && caseItem.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {caseItem.tags.slice(0, 2).map((tag, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                          {caseItem.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{caseItem.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={getStatusColor(caseItem.status as string)}
                    >
                      {getStatusText(caseItem.status as string)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={`flex items-center gap-1 w-fit ${getAccessLevelColor(caseItem.accessLevel)}`}
                    >
                      {getAccessLevelIcon(caseItem.accessLevel)}
                      {getAccessLevelText(caseItem.accessLevel)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {formatDate(caseItem._creationTime as number)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination controls */}
          {casesWithAccess?.page && casesWithAccess.page.length > 0 && (
            <div className="mt-6">
              <PaginationControls
                totalResults={casesWithAccess?.totalCount || 0}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={Math.ceil((casesWithAccess?.totalCount || 0) / pageSize)}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
