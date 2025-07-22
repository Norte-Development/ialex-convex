import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import ConditionalLayout from "@/components/Layout/ConditionalLayout";
import { useLayout } from "@/context/LayoutContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  UserMinus,
  Trash2,
  Calendar,
  Mail,
  User,
  Shield,
} from "lucide-react";
import { useState } from "react";
import InviteUserDialog from "@/components/Teams/InviteUserDialog";
import PendingInvitesTable from "@/components/Teams/PendingInvitesTable";
import TeamCasesView from "@/components/Cases/TeamCasesView";
import { TeamInvite } from "../../types/teams";

export default function TeamManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isInCaseContext } = useLayout();

  const team = useQuery(api.functions.teams.getTeamById, { teamId: id as any });
  const members = team?.members;
  const pendingInvites = team?.pendingInvites;

  const removeUserFromTeam = useMutation(
    api.functions.teams.removeUserFromTeam,
  );

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
      <ConditionalLayout>
        <div
          className={`flex flex-col gap-4 w-full min-h-screen px-10 bg-[#f7f7f7] ${isInCaseContext ? "pt-5" : "pt-20"}`}
        >
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Equipo no encontrado</div>
          </div>
        </div>
      </ConditionalLayout>
    );
  }

  return (
    <ConditionalLayout>
      <div
        className={`flex flex-col gap-6 w-full min-h-screen px-10 bg-[#f7f7f7] pb-10 ${isInCaseContext ? "pt-5" : "pt-20"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between ">
          <div className="flex flex-col  gap-5">
            <Button
              variant="outline"
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
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTeam}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Equipo
            </Button>
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
                <p className="text-lg">
                  {team.isActive ? "Activo" : "Inactivo"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Miembros del Equipo
                </CardTitle>
                <CardDescription>
                  Gestiona los miembros de este equipo
                </CardDescription>
              </div>
              <InviteUserDialog teamId={id!} />
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
            {members === undefined ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-500">Cargando miembros...</div>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Users className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay miembros
                </h3>
                <p className="text-gray-500 text-center">
                  Agrega el primer miembro a este equipo.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {members.map((member) => (
                  <div
                    key={member?._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{member?.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Mail className="w-3 h-3" />
                          {member?.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-500" />
                        <Badge variant="outline" className="capitalize">
                          {member?.teamRole}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleRemoveMember(member?._id as string)
                        }
                        disabled={removingMember === member?._id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        {removingMember === member?._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {id && (
          <PendingInvitesTable
            pendingInvites={pendingInvites as TeamInvite[]}
          />
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
              <TeamCasesView teamId={id as any} />
            </CardContent>
          </Card>
        )}
      </div>
    </ConditionalLayout>
  );
}
