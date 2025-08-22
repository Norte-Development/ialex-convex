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
  DialogTrigger 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PERMISSIONS, type Permission } from "@/permissions/types";

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

const PERMISSION_OPTIONS = [
  { 
    id: PERMISSIONS.CASE_VIEW, 
    label: "Ver información básica", 
    description: "Acceso a información general del caso",
    category: "Case"
  },
  { 
    id: PERMISSIONS.CASE_EDIT, 
    label: "Editar caso", 
    description: "Modificar información del caso",
    category: "Case"
  },
  { 
    id: PERMISSIONS.DOC_READ, 
    label: "Ver documentos", 
    description: "Acceso a visualizar documentos",
    category: "Documents"
  },
  { 
    id: PERMISSIONS.DOC_WRITE, 
    label: "Gestionar documentos", 
    description: "Crear y editar documentos",
    category: "Documents"
  },
  { 
    id: PERMISSIONS.DOC_DELETE, 
    label: "Eliminar documentos", 
    description: "Eliminar documentos del caso",
    category: "Documents"
  },
  { 
    id: PERMISSIONS.ESCRITO_READ, 
    label: "Ver escritos", 
    description: "Acceso a visualizar escritos legales",
    category: "Escritos"
  },
  { 
    id: PERMISSIONS.ESCRITO_WRITE, 
    label: "Gestionar escritos", 
    description: "Crear y editar escritos legales",
    category: "Escritos"
  },
  { 
    id: PERMISSIONS.ESCRITO_DELETE, 
    label: "Eliminar escritos", 
    description: "Eliminar escritos del caso",
    category: "Escritos"
  },
  { 
    id: PERMISSIONS.CLIENT_READ, 
    label: "Ver clientes", 
    description: "Acceso a información de clientes",
    category: "Clients"
  },
  { 
    id: PERMISSIONS.CLIENT_WRITE, 
    label: "Gestionar clientes", 
    description: "Agregar y editar clientes",
    category: "Clients"
  },
  { 
    id: PERMISSIONS.CLIENT_DELETE, 
    label: "Eliminar clientes", 
    description: "Remover clientes del caso",
    category: "Clients"
  },
  { 
    id: PERMISSIONS.TEAM_READ, 
    label: "Ver equipos", 
    description: "Ver información de equipos",
    category: "Teams"
  },
  { 
    id: PERMISSIONS.TEAM_WRITE, 
    label: "Gestionar equipos", 
    description: "Gestionar acceso de equipos",
    category: "Teams"
  },
  { 
    id: PERMISSIONS.CHAT_ACCESS, 
    label: "Chat IA", 
    description: "Acceso al asistente de IA",
    category: "Chat"
  },
  { 
    id: PERMISSIONS.FULL, 
    label: "Acceso completo", 
    description: "Todos los permisos",
    category: "Full"
  },
];

export default function TeamMemberPermissionsDialog({
  member,
  caseId,
  teamId,
}: TeamMemberPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current member permissions
  const currentAccess = useQuery(
    api.functions.permissions.getTeamMembersWithCaseAccess,
    { caseId, teamId }
  );

  // Mutations
  const grantPermissions = useMutation(api.functions.permissions.grantTeamMemberCaseAccess);

  // Find current member's permissions
  const memberAccess = currentAccess?.find(access => access.user._id === member._id);
  const currentPermissions = memberAccess?.specificAccess?.permissions || [];

  // Initialize selected permissions when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedPermissions(currentPermissions as Permission[]);
    }
  };

  const handlePermissionChange = (permissionId: Permission, checked: boolean) => {
    if (checked) {
      setSelectedPermissions(prev => [...prev, permissionId]);
    } else {
      setSelectedPermissions(prev => prev.filter(p => p !== permissionId));
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await grantPermissions({
        caseId,
        teamId,
        userId: member._id,
        permissions: selectedPermissions,
      });

      toast.success(`Permisos actualizados para ${member.name}`);
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedPermissions = PERMISSION_OPTIONS.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof PERMISSION_OPTIONS>);

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
          <DialogTitle>Gestionar Permisos de {member.name}</DialogTitle>
          <DialogDescription>
            Configura los permisos específicos que {member.name} tendrá en este caso.
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
          {memberAccess?.hasSpecificPermissions && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-800 mb-1">
                Permisos Específicos Activos
              </div>
              <div className="text-xs text-blue-600">
                Este miembro tiene {currentPermissions.length} permisos específicos configurados
              </div>
            </div>
          )}

          {/* Permission Groups */}
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category}>
                <h4 className="font-medium text-sm text-gray-700 mb-3">{category}</h4>
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Checkbox
                        id={permission.id}
                        checked={selectedPermissions.includes(permission.id)}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(permission.id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <Label 
                          htmlFor={permission.id} 
                          className="text-sm font-medium cursor-pointer"
                        >
                          {permission.label}
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {category !== "Full" && <Separator className="mt-4" />}
              </div>
            ))}
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
              Guardar Permisos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 