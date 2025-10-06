import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { SignUp } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Calendar, UserPlus } from "lucide-react";

export default function SignupInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptanceComplete, setAcceptanceComplete] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const token = searchParams.get('token');

  // Validate the invitation token
  const inviteDetails = useQuery(
    api.functions.teams.validateInviteToken,
    token ? { token } : "skip"
  );

  const createUserAndJoinTeam = useMutation(api.functions.teams.createUserAndJoinTeam);
  const { user: clerkUser } = useUser();

  // Auto-accept invitation once user is signed in
  useEffect(() => {
    const autoJoinTeam = async () => {
      if (isSignedIn && clerkUser && token && inviteDetails && !acceptanceComplete && !isAccepting) {
        setIsAccepting(true);
        try {
          const email = clerkUser.emailAddresses[0]?.emailAddress || "";
          const name = clerkUser.fullName || clerkUser.firstName || "Usuario";
          
          await createUserAndJoinTeam({
            clerkId: clerkUser.id,
            email: email,
            name: name,
            token: token,
          });
          setAcceptanceComplete(true);
        } catch (error) {
          console.error("Error joining team:", error);
          // For signup flow, we'll show the error in the UI instead of alert
          setIsAccepting(false);
        }
      }
    };

    autoJoinTeam();
  }, [isSignedIn, clerkUser, token, inviteDetails, acceptanceComplete, isAccepting, createUserAndJoinTeam]);

  const handleGoToTeams = () => {
    navigate('/equipos');
  };

  const handleCreateAccount = () => {
    setShowSignUp(true);
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
            <CardTitle className="text-green-600">¡Cuenta Creada y Equipo Unido!</CardTitle>
            <CardDescription>
              Has creado tu cuenta exitosamente y te has unido al equipo <strong>{inviteDetails.teamName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoToTeams} className="w-full">
              Comenzar a Usar iAlex
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auto-accepting after signup
  if (isSignedIn && isAccepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Uniéndote al equipo...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show custom signup component
  if (showSignUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Crear Cuenta para {inviteDetails.teamName}
            </h2>
            <p className="text-gray-600">
              Completa tu registro para unirte al equipo
            </p>
          </div>
          
          <SignUp 
            redirectUrl={window.location.href}
            localization={{
              locale: "es"
            }}
            appearance={{
              elements: {
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                card: "shadow-lg",
                headerTitle: "text-gray-900",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50",
                formFieldInput: "border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                footerActionLink: "text-blue-600 hover:text-blue-800"
              }
            }}
          />
          
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => setShowSignUp(false)}
              className="text-sm"
            >
              ← Volver a la invitación
            </Button>
          </div>
        </div>
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
          <UserPlus className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>¡Te han invitado a iAlex!</CardTitle>
          <CardDescription>
            Crea tu cuenta para unirte al equipo
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>¿Qué es iAlex?</strong> Una plataforma de gestión legal que te ayudará a 
              colaborar con tu equipo en casos, documentos y más.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleCreateAccount}
              className="w-full"
            >
              Crear Cuenta y Unirse
            </Button>
            
            <p className="text-xs text-center text-gray-500">
              Al crear una cuenta, automáticamente te unirás al equipo {inviteDetails.teamName}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 