import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, X, Mail } from "lucide-react";

interface PendingInvitesTableProps {
  teamId: string;
}

export default function PendingInvitesTable({ teamId }: PendingInvitesTableProps) {
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const invites = useQuery(api.functions.teams.getTeamInvites, {
    teamId: teamId as any,
  });

  const cancelInvite = useMutation(api.functions.teams.cancelTeamInvite);
  const resendInvite = useMutation(api.functions.teams.resendTeamInvite);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleCancel = async (inviteId: string) => {
    if (!confirm("¿Estás seguro de que quieres cancelar esta invitación?")) {
      return;
    }

    setLoadingActions((prev) => ({ ...prev, [`cancel-${inviteId}`]: true }));
    try {
      await cancelInvite({ inviteId: inviteId as any });
      showMessage('success', "Invitación cancelada exitosamente");
    } catch (error) {
      console.error("Error canceling invitation:", error);
      showMessage('error', (error as Error).message);
    } finally {
      setLoadingActions((prev) => ({ ...prev, [`cancel-${inviteId}`]: false }));
    }
  };

  const handleResend = async (inviteId: string) => {
    setLoadingActions((prev) => ({ ...prev, [`resend-${inviteId}`]: true }));
    try {
      await resendInvite({ inviteId: inviteId as any });
      showMessage('success', "Invitación reenviada exitosamente");
    } catch (error) {
      console.error("Error resending invitation:", error);
      showMessage('error', (error as Error).message);
    } finally {
      setLoadingActions((prev) => ({ ...prev, [`resend-${inviteId}`]: false }));
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "abogado":
        return "default";
      case "secretario":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "abogado":
        return "Abogado";
      case "secretario":
        return "Secretario";
      default:
        return role;
    }
  };

  if (invites === undefined) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Cargando invitaciones...</p>
      </div>
    );
  }

  if (!invites || invites.length === 0) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">No hay invitaciones pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        <h3 className="text-lg font-semibold">Invitaciones Pendientes</h3>
        <Badge variant="outline">{invites.length}</Badge>
      </div>

      {actionMessage && (
        <div className={`border rounded-lg p-3 ${
          actionMessage.type === 'success' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm ${
            actionMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {actionMessage.text}
          </p>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Invitado por</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite._id}>
                <TableCell className="font-medium">{invite.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(invite.role)}>
                    {getRoleDisplayName(invite.role)}
                  </Badge>
                </TableCell>
                <TableCell>{invite.inviterName}</TableCell>
                <TableCell>
                  {new Date(invite.expiresAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(invite._id)}
                      disabled={loadingActions[`resend-${invite._id}`]}
                      className="h-8 w-8 p-0"
                      title="Reenviar invitación"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(invite._id)}
                      disabled={loadingActions[`cancel-${invite._id}`]}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      title="Cancelar invitación"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 