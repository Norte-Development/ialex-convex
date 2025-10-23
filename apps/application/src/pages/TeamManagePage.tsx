import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Trash2, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import InviteUserDialog from "@/components/Teams/InviteUserDialog";
import PendingInvitesTable from "@/components/Teams/PendingInvitesTable";
import TeamCasesListContainer from "@/components/Cases/TeamCasesListContainer";
import TeamMembersTableContainer from "@/components/Teams/TeamMembersTableContainer";
import { TeamInvite } from "../../types/teams";
import { useBillingData, UsageMeter } from "@/components/Billing";

export default function TeamManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const team = useQuery(api.functions.teams.getTeamById, { teamId: id as any });
  const members = team?.members;
  const pendingInvites = team?.pendingInvites;

  // Get current user - only if we have team data
  const currentUser = useQuery(
    api.functions.users.getCurrentUser,
    team ? {} : "skip",
  );

  // Check if current user is admin of this team
  const isTeamAdmin = useMemo(() => {
    if (!currentUser || !members) return false;
    const currentMember = members.find(
      (member) => member?._id === currentUser._id,
    );
    return currentMember?.teamRole === "admin";
  }, [currentUser, members]);

  const removeUserFromTeam = useMutation(
    api.functions.teams.removeUserFromTeam,
  );

  // Get team member limits and usage data
  const memberCheck = useQuery(
    api.billing.features.canAddTeamMember,
    id ? { teamId: id as any } : "skip",
  );

  const { usage, limits } = useBillingData({ teamId: id as any });

  const deleteTeam = useMutation(api.functions.teams.deleteTeam);

  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;

    if (
      confirm("¿Estás seguro de que quieres remover este miembro del equipo?")
    ) {
      setRemovingMember(userId);
      try {
        await removeUserFromTeam({
          teamId: id as any,
          userId: userId as any,
        });
        showMessage("success", "Miembro removido exitosamente");
      } catch (error) {
        console.error("Error removing member:", error);
        showMessage("error", (error as Error).message);
      } finally {
        setRemovingMember(null);
      }
    }
  };

  const handleDeleteTeam = async () => {
    if (!id || !team) return;

    if (
      confirm(
        `¿Estás seguro de que quieres eliminar el equipo "${team.name}"? Esta acción no se puede deshacer.`,
      )
    ) {
      await deleteTeam({ teamId: id as any });
      showMessage("success", "Equipo eliminado exitosamente");
      navigate("/equipo");
    }
  };

  if (!team) {
    return (
      <div
        className={`flex flex-col gap-4 w-full min-h-screen px-10 bg-[#f7f7f7] `}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Equipo no encontrado</div>
        </div>
      </div>
    );
  }
  console.log("Miembros del equipo", members);
  return (
    <div
      className={`flex flex-col gap-6 w-full min-h-screen px-10 bg-[#f7f7f7] pb-10 pt-15 `}
    >
      {/* Header */}
      <div className="flex items-center justify-between ">
        <div className="flex flex-col  gap-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/equipo")}
            className="flex items-center gap-2 cursor-pointer w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-black flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              {team.name}
            </h1>
            <p className="text-gray-600">
              {team.description || "Sin descripción"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 ">
          <Badge
            variant={team.isActive ? "default" : "secondary"}
            className={
              team.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }
          >
            {team.isActive ? "Activo" : "Inactivo"}
          </Badge>

          {isTeamAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTeam}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Equipo
            </Button>
          )}
        </div>
      </div>

      {/* Team Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Información del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Creado</p>
              <p className="text-lg">
                {new Date(team._creationTime).toLocaleDateString("es-ES")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Miembros</p>
              <p className="text-lg">{members?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Estado</p>
              <p className="text-lg">{team.isActive ? "Activo" : "Inactivo"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Usage Section */}
      <Card>
        <CardHeader>
          <CardTitle>Uso del Equipo</CardTitle>
          <CardDescription>Límites y uso actual del equipo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team members */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Miembros</span>
            <span className="text-sm text-gray-600">
              {memberCheck?.currentCount || 0} / {memberCheck?.maxAllowed || 0}
            </span>
          </div>

          {/* Team cases */}
          {usage && limits && (
            <UsageMeter
              used={usage.casesCount}
              limit={limits.cases}
              label="Casos del Equipo"
            />
          )}

          {/* Team library */}
          {usage && limits && (
            <UsageMeter
              used={usage.libraryDocumentsCount}
              limit={limits.libraryDocuments}
              label="Biblioteca del Equipo"
            />
          )}

          {/* Team storage */}
          {usage && limits && (
            <UsageMeter
              used={usage.storageUsedBytes / (1024 * 1024 * 1024)}
              limit={limits.storageGB}
              label="Almacenamiento (GB)"
            />
          )}
        </CardContent>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-end justify-start w-full">
            {isTeamAdmin && <InviteUserDialog teamId={id as any} />}
          </div>
        </CardHeader>
        <CardContent>
          {actionMessage && (
            <div
              className={`mb-4 border rounded-lg p-3 ${
                actionMessage.type === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p
                className={`text-sm ${
                  actionMessage.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {actionMessage.text}
              </p>
            </div>
          )}
          <TeamMembersTableContainer
            teamId={id as any}
            pageSize={20}
            onRemoveMember={handleRemoveMember}
            removingMember={removingMember}
            isAdmin={isTeamAdmin}
          />
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {id && (
        <PendingInvitesTable pendingInvites={pendingInvites as TeamInvite[]} />
      )}

      {/* Team Cases Section */}
      {id && (
        <Card>
          <CardHeader>
            <CardTitle>Casos del Equipo</CardTitle>
            <CardDescription>
              Casos a los que este equipo tiene acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamCasesListContainer teamId={id as any} pageSize={20} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
