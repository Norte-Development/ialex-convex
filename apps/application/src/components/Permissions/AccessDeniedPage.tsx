import { Shield, ArrowLeft, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionError } from "@/types/errors";

interface AccessDeniedPageProps {
  error?: PermissionError;
  caseId?: string;
  onRequestAccess?: () => void;
}

export function AccessDeniedPage({ 
  error, 
  caseId, 
  onRequestAccess 
}: AccessDeniedPageProps) {
  const getErrorMessage = () => {
    if (error?.code === "UNAUTHORIZED") {
      return "Debes iniciar sesión para acceder a este recurso.";
    }
    
    if (error?.code === "FORBIDDEN") {
      return "No tienes los permisos necesarios para acceder a este recurso.";
    }
    
    return "No tienes los permisos necesarios para acceder a este recurso.";
  };

  const getActionButtons = () => {
    const buttons = [];
    
    buttons.push(
      <Button key="back" variant="outline" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>
    );
    
    if (onRequestAccess) {
      buttons.push(
        <Button key="request" onClick={onRequestAccess}>
          <Mail className="h-4 w-4 mr-2" />
          Solicitar Acceso
        </Button>
      );
    }
    
    return buttons;
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center max-w-md">
        <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Acceso Denegado
        </h2>
        <p className="text-gray-600 mb-6">
          {getErrorMessage()}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {getActionButtons()}
        </div>
        
        {caseId && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <Users className="h-4 w-4 inline mr-1" />
              Contacta al administrador del caso para solicitar acceso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 