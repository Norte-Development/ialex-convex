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

interface TeamAccessDialogProps {
  caseId: Id<"cases">;
  trigger?: React.ReactNode;
}

type AccessLevel = "read" | "full";

export default function TeamAccessDialog({
  caseId,
  trigger,
}: TeamAccessDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | "">("");
  const [selectedAccessLevel, setSelectedAccessLevel] =
    useState<AccessLevel>("read");

  const teamsWithAccess = useQuery(api.functions.teams.getTeamsWithCaseAccess, {
    caseId,
  });
  const allTeams = useQuery(api.functions.teams.getTeams, {});
  const grantAccess = useMutation(api.functions.teams.grantTeamCaseAccess);
  const revokeAccess = useMutation(api.functions.teams.revokeTeamCaseAccess);

  const availableTeams =
    allTeams?.filter(
      (team) =>
        !teamsWithAccess?.some(
          (teamWithAccess) => teamWithAccess._id === team._id,
        ),
    ) || [];

  const handleGrantAccess = async () => {
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
      setSelectedTeamId("");
      setSelectedAccessLevel("read");
    } catch (error) {
      console.error("Error granting access:", error);
      toast.error("Error al otorgar acceso");
    }
  };

  const handleRevokeAccess = async (teamId: Id<"teams">) => {
    try {
      await revokeAccess({ caseId, teamId });
      toast.success("Acceso revocado exitosamente");
    } catch (error) {
      console.error("Error revoking access:", error);
      toast.error("Error al revocar acceso");
    }
  };

  const getAccessLevelIcon = (level: AccessLevel) => {
    return level === "full" ? (
      <Shield className="h-4 w-4 text-blue-600" />
    ) : (
      <Eye className="h-4 w-4 text-gray-600" />
    );
  };

  const getAccessLevelText = (level: AccessLevel) => {
    return level === "full" ? "Acceso Completo" : "Solo Lectura";
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestión de Acceso de Equipos</DialogTitle>
          <DialogDescription>
            Otorga o revoca acceso de equipos a este caso. Los equipos con
            acceso completo pueden modificar el caso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Team Access Section */}
          {availableTeams.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">
                Otorgar Acceso a Nuevo Equipo
              </h4>
              <div className="flex gap-2">
                <Select
                  value={selectedTeamId}
                  onValueChange={(value: Id<"teams">) =>
                    setSelectedTeamId(value)
                  }
                >
                  <SelectTrigger className="flex-1">
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
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Solo Lectura</SelectItem>
                    <SelectItem value="full">Acceso Completo</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleGrantAccess}
                  disabled={!selectedTeamId}
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Otorgar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Equipos con Acceso</h4>
            {teamsWithAccess && teamsWithAccess.length > 0 ? (
              <div className="space-y-2">
                {teamsWithAccess.map((team) => (
                  <div
                    key={team._id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{team.name}</p>
                        {team.description && (
                          <p className="text-sm text-gray-500">
                            {team.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
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
                        className="text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 " />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay equipos con acceso a este caso
              </p>
            )}
          </div>

          {availableTeams.length === 0 && teamsWithAccess?.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay equipos disponibles para gestionar
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
