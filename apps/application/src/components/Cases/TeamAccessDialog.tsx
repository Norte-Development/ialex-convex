import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Users, Plus, Trash2, Shield, Eye } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/context/CasePermissionsContext";
import { PermissionToasts } from "@/lib/permissionToasts";

interface TeamAccessDialogProps {
  caseId: Id<"cases">;
  trigger?: React.ReactNode;
}

type AccessLevel = "none" | "basic" | "advanced" | "admin";

export default function TeamAccessDialog({
  caseId,
  trigger,
}: TeamAccessDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | "">("");
  const [selectedAccessLevel, setSelectedAccessLevel] =
    useState<AccessLevel>("basic");

  // Add permissions check
  const { can } = usePermissions();

  const teamsWithAccess = useQuery(api.functions.teams.getTeamsWithCaseAccess, {
    caseId,
  });
  const allTeams = useQuery(api.functions.teams.getTeams, {});
  const grantAccess = useMutation(api.functions.teams.grantNewTeamCaseAccess);
  const revokeAccess = useMutation(api.functions.teams.revokeNewTeamCaseAccess);

  const availableTeams =
    allTeams?.page?.filter(
      (team) =>
        !teamsWithAccess?.some(
          (teamWithAccess) => teamWithAccess._id === team._id,
        ),
    ) || [];

  const handleGrantAccess = async () => {
    // Check permissions first
    if (!can.teams.write) {
      PermissionToasts.teams.managePermissions();
      return;
    }

    if (!selectedTeamId) {
      toast.error("Selecciona un equipo");
      return;
    }

    try {
      await grantAccess({
        caseId,
        teamId: selectedTeamId as Id<"teams">,
        accessLevel: selectedAccessLevel,
      });

      toast.success("Acceso otorgado exitosamente");
      // Reset selections to allow adding more teams
      setSelectedTeamId("");
      setSelectedAccessLevel("basic");
      // Don't close the dialog - user can add more teams
    } catch (error) {
      console.error("Error granting access:", error);
      toast.error("Error al otorgar acceso");
    }
  };

  const handleRevokeAccess = async (teamId: Id<"teams">) => {
    // Check permissions first
    if (!can.teams.write) {
      PermissionToasts.teams.managePermissions();
      return;
    }

    try {
      await revokeAccess({ caseId, teamId });
      toast.success("Acceso revocado exitosamente");
    } catch (error) {
      console.error("Error revoking access:", error);
      toast.error("Error al revocar acceso");
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Gestionar Equipos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Gestión de Acceso de Equipos
          </DialogTitle>
          <DialogDescription className="text-base">
            Otorga o revoca acceso de equipos a este caso. Puedes agregar
            múltiples equipos sin cerrar esta ventana.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 pb-4">
          {/* Add Team Access Section - Always show if there are teams available */}
          <div className="space-y-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
            {availableTeams.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-3">
                  <Select
                    value={selectedTeamId}
                    onValueChange={(value: Id<"teams">) =>
                      setSelectedTeamId(value)
                    }
                  >
                    <SelectTrigger className="flex-1 min-w-[300px] bg-white h-11">
                      <SelectValue placeholder="Seleccionar equipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((team) => (
                        <SelectItem key={team._id} value={team._id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedAccessLevel}
                    onValueChange={(value: AccessLevel) =>
                      setSelectedAccessLevel(value)
                    }
                  >
                    <SelectTrigger className="w-56 bg-white h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Acceso Básico</SelectItem>
                      <SelectItem value="advanced">Acceso Avanzado</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleGrantAccess}
                    disabled={!selectedTeamId}
                    className="cursor-pointer h-11 px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Otorgar
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Todos los equipos disponibles ya tienen acceso a este caso.
              </p>
            )}
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Equipos con Acceso</h4>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {teamsWithAccess?.length || 0} equipo(s)
              </Badge>
            </div>
            {teamsWithAccess && teamsWithAccess.length > 0 ? (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                {teamsWithAccess.map((team) => (
                  <div
                    key={team._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Users className="h-6 w-6 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-base">{team.name}</p>
                        {team.description && (
                          <p className="text-sm text-gray-500 truncate">
                            {team.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
                      >
                        {getAccessLevelIcon(team.accessLevel)}
                        {getAccessLevelText(team.accessLevel)}
                      </Badge>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRevokeAccess(team._id as Id<"teams">)
                        }
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8 border rounded-lg bg-gray-50">
                No hay equipos con acceso a este caso
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
