import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditUserPermissionsDialogProps {
  caseId: Id<"cases">;
  userId: Id<"users">;
  userName: string;
  userEmail: string;
  currentAccessLevel: "none" | "basic" | "advanced" | "admin";
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function EditUserPermissionsDialog({
  caseId,
  userId,
  userName,
  userEmail,
  currentAccessLevel,
  trigger,
  onSuccess,
}: EditUserPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<
    "none" | "basic" | "advanced" | "admin"
  >(currentAccessLevel);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutation to update user access level
  const grantUserAccess = useMutation(
    api.functions.permissions.grantUserCaseAccess,
  );

  // Define hierarchical access levels
  const accessLevelOptions = [
    {
      value: "none" as const,
      label: "Sin Acceso",
      description: "El usuario no tendrá acceso al caso",
    },
    {
      value: "basic" as const,
      label: "Acceso Básico",
      description:
        "Puede ver información del caso, documentos y escritos (solo lectura)",
    },
    {
      value: "advanced" as const,
      label: "Acceso Avanzado",
      description: "Incluye acceso básico + edición de documentos y escritos",
    },
    {
      value: "admin" as const,
      label: "Administrador",
      description: "Acceso completo incluyendo gestión de equipos y permisos",
    },
  ];

  // Initialize access level when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedAccessLevel(currentAccessLevel);
    }
  };

  // Handle access level change
  const handleAccessLevelChange = (
    value: "none" | "basic" | "advanced" | "admin",
  ) => {
    setSelectedAccessLevel(value);
  };

  const handleUpdatePermissions = async () => {
    setIsSubmitting(true);
    try {
      // Grant the selected access level (including "none" to remove access)
      await grantUserAccess({
        caseId,
        userId,
        accessLevel: selectedAccessLevel,
      });

      if (onSuccess) {
        onSuccess();
      }

      setIsOpen(false);
      toast.success("Permisos actualizados correctamente");
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "advanced":
        return "bg-blue-100 text-blue-800";
      case "basic":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAccessLevelText = (level: string) => {
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

  const hasChanges = () => {
    return selectedAccessLevel !== currentAccessLevel;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Permisos de Usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{userName}</span>
              <span className="text-sm text-gray-500">{userEmail}</span>
            </div>
            <Badge className={getAccessLevelColor(selectedAccessLevel)}>
              {getAccessLevelText(selectedAccessLevel)}
            </Badge>
          </div>

          {/* Access Level Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Nivel de Acceso</h4>
            <div className="space-y-3">
              {accessLevelOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedAccessLevel === option.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => handleAccessLevelChange(option.value)}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value={option.value}
                    checked={selectedAccessLevel === option.value}
                    onChange={() => handleAccessLevelChange(option.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {option.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePermissions}
              disabled={isSubmitting || !hasChanges()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Edit className="h-4 w-4 mr-2" />
              )}
              Actualizar Permisos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
