import React from "react";
import { useOrganization } from "@clerk/clerk-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function RequireAdminsOrg({ children }: { children: React.ReactNode }) {
  const { isLoaded, organization } = useOrganization();

  console.log("Current organization:", organization);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  const isAdminsOrg = organization?.slug === "admins";

  if (!isAdminsOrg) {
    return (
      <div className="flex flex-col w-full justify-center items-center h-screen ">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acceso Denegado</strong>
            <br />
            Esta sección está disponible solo para la organización{" "}
            <strong>admins</strong>.
            <br />
            <span className="text-sm text-muted-foreground">
              Organización activa: {organization?.slug ?? "ninguna"}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
