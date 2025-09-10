import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AccessLevel = "basic" | "advanced" | "admin";

interface TeamMemberPermissionsDialogProps {
  member: {
    _id: Id<"users">;
    name: string;
    email: string;
    role: string;
  };
  caseId: Id<"cases">;
  teamId: Id<"teams">;
}

const ACCESS_LEVEL_OPTIONS = [
  {
    id: "basic" as AccessLevel,
    label: "Básico",
    description:
      "Ver información del caso, documentos y escritos (solo lectura)",
    permissions: [
      "Ver información del caso",
      "Ver documentos",
      "Ver escritos",
      "Ver clientes",
      "Chat IA básico",
    ],
  },
  {
    id: "advanced" as AccessLevel,
    label: "Avanzado",
    description:
      "Todas las funciones básicas + edición de documentos y escritos",
    permissions: [
      "Todas las funciones básicas",
      "Editar documentos",
      "Crear escritos",
      "Editar escritos",
      "Gestionar clientes",
      "Chat IA completo",
    ],
  },
  {
    id: "admin" as AccessLevel,
    label: "Administrador",
    description: "Acceso completo incluyendo eliminación y gestión de equipos",
    permissions: [
      "Todas las funciones avanzadas",
      "Eliminar documentos",
      "Eliminar escritos",
      "Gestionar equipos",
      "Acceso completo al sistema",
    ],
  },
];

export default function TeamMemberPermissionsDialog({
  member,
  caseId,
  teamId,
}: TeamMemberPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccessLevel, setSelectedAccessLevel] =
    useState<AccessLevel>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current member permissions
  const currentAccess = useQuery(
    api.functions.permissions.getNewTeamMembersWithCaseAccess,
    { caseId, teamId },
  );

  // Mutations
  const grantPermissions = useMutation(
    api.functions.permissions.grantNewTeamMemberCaseAccess,
  );

  // Find current member's access level
  const memberAccess = currentAccess?.find(
    (access) => access.user._id === member._id,
  );
  const currentAccessLevel =
    memberAccess?.individualAccess?.accessLevel ||
    memberAccess?.teamAccess?.accessLevel ||
    "basic";

  // Initialize selected access level when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedAccessLevel(currentAccessLevel as AccessLevel);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await grantPermissions({
        caseId,
        teamId,
        userId: member._id,
        accessLevel: selectedAccessLevel,
      });

      toast.success(`Nivel de acceso actualizado para ${member.name}`);
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Shield className="h-4 w-4 mr-2" />
          Permisos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Nivel de Acceso de {member.name}</DialogTitle>
          <DialogDescription>
            Configura el nivel de acceso que {member.name} tendrá en este caso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Member Info */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{member.name}</div>
              <div className="text-sm text-gray-500">{member.email}</div>
            </div>
            <Badge variant="secondary">{member.role}</Badge>
          </div>

          {/* Current Status */}
          {memberAccess && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-800 mb-1">
                Nivel Actual:{" "}
                {currentAccessLevel.charAt(0).toUpperCase() +
                  currentAccessLevel.slice(1)}
              </div>
              <div className="text-xs text-blue-600">
                {memberAccess.individualAccess
                  ? "Acceso individual"
                  : "Acceso por equipo"}
              </div>
            </div>
          )}

          {/* Access Level Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-700">
              Seleccionar Nivel de Acceso
            </h4>
            <div className="space-y-3">
              {ACCESS_LEVEL_OPTIONS.map((level) => (
                <div
                  key={level.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    id={level.id}
                    name="accessLevel"
                    value={level.id}
                    checked={selectedAccessLevel === level.id}
                    onChange={(e) =>
                      setSelectedAccessLevel(e.target.value as AccessLevel)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={level.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {level.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-1 mb-2">
                      {level.description}
                    </p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {level.permissions.map((permission, index) => (
                        <li key={index} className="flex items-center">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Actualizar Nivel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
