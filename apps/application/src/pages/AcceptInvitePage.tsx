import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Users, Calendar } from "lucide-react";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptanceComplete, setAcceptanceComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  // Validate the invitation token
  const inviteDetails = useQuery(
    api.functions.teams.validateInviteToken,
    token ? { token } : "skip"
  );

  const acceptInvite = useMutation(api.functions.teams.acceptTeamInvite);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isSignedIn && inviteDetails !== undefined) {
      // Redirect to sign-in with the current URL as redirect
      window.location.href = `/signin?redirect_url=${encodeURIComponent(window.location.href)}`;
    }
  }, [isSignedIn, inviteDetails]);

  const handleAcceptInvite = async () => {
    if (!token) return;

    setIsAccepting(true);
    setError(null);
    try {
      await acceptInvite({ token });
      setAcceptanceComplete(true);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError((error as Error).message);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGoToTeams = () => {
    navigate('/equipos');
  };

  // Loading state
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Token de Invitación Inválido</CardTitle>
            <CardDescription>
              El enlace de invitación no es válido o está dañado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (inviteDetails === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Validando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invitación No Válida</CardTitle>
            <CardDescription>
              Esta invitación ha expirado, ya fue aceptada, o no existe.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success state
  if (acceptanceComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-600">¡Invitación Aceptada!</CardTitle>
            <CardDescription>
              Te has unido exitosamente al equipo <strong>{inviteDetails.teamName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoToTeams} className="w-full">
              Ver Mis Equipos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>Invitación al Equipo</CardTitle>
          <CardDescription>
            Has sido invitado/a a unirte a un equipo en iAlex
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">{inviteDetails.teamName}</h3>
              <p className="text-sm text-gray-600">
                Invitado por: <span className="font-medium">{inviteDetails.inviterName}</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-600">Rol asignado:</span>
              <Badge variant={getRoleBadgeVariant(inviteDetails.role)}>
                {getRoleDisplayName(inviteDetails.role)}
              </Badge>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>
                Expira: {new Date(inviteDetails.expiresAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              onClick={handleAcceptInvite} 
              disabled={isAccepting}
              className="w-full"
            >
              {isAccepting ? "Aceptando..." : "Aceptar Invitación"}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
              disabled={isAccepting}
            >
              Rechazar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 