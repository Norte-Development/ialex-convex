import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PERMISSIONS, type Permission } from "@/permissions/types";

interface EditUserPermissionsDialogProps {
  caseId: Id<"cases">;
  userId: Id<"users">;
  userName: string;
  userEmail: string;
  currentPermissions: string[];
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface PermissionOption {
  key: string;
  label: string;
  description: string;
  category: string;
}

export default function EditUserPermissionsDialog({ 
  caseId, 
  userId,
  userName,
  userEmail,
  currentPermissions,
  trigger,
  onSuccess
}: EditUserPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutation to update user permissions
  const updateUserPermissions = useMutation(api.functions.permissions.grantUserCaseAccess);

  // Define all available permissions with their metadata
  const permissionOptions: PermissionOption[] = [
    {
      key: PERMISSIONS.CASE_VIEW,
      label: "Ver Caso",
      description: "Puede ver la información básica del caso",
      category: "Caso"
    },
    {
      key: PERMISSIONS.CASE_EDIT,
      label: "Editar Caso",
      description: "Puede modificar la información del caso",
      category: "Caso"
    },
    {
      key: PERMISSIONS.DOC_READ,
      label: "Ver Documentos",
      description: "Puede ver y descargar documentos del caso",
      category: "Documentos"
    },
    {
      key: PERMISSIONS.DOC_WRITE,
      label: "Editar Documentos",
      description: "Puede subir, editar y eliminar documentos",
      category: "Documentos"
    },
    {
      key: PERMISSIONS.ESCRITO_READ,
      label: "Ver Escritos",
      description: "Puede ver los escritos legales del caso",
      category: "Escritos"
    },
    {
      key: PERMISSIONS.ESCRITO_WRITE,
      label: "Editar Escritos",
      description: "Puede crear y editar escritos legales",
      category: "Escritos"
    },
    {
      key: PERMISSIONS.CLIENT_READ,
      label: "Ver Clientes",
      description: "Puede ver la información de los clientes",
      category: "Clientes"
    },
    {
      key: PERMISSIONS.CLIENT_WRITE,
      label: "Editar Clientes",
      description: "Puede modificar la información de los clientes",
      category: "Clientes"
    },
    {
      key: PERMISSIONS.TEAM_READ,
      label: "Ver Equipos",
      description: "Puede ver los equipos asignados al caso",
      category: "Equipos"
    },
    {
      key: PERMISSIONS.CHAT_ACCESS,
      label: "Acceso al Chat IA",
      description: "Puede usar el chat de inteligencia artificial",
      category: "Chat"
    },
    {
      key: PERMISSIONS.FULL,
      label: "Acceso Completo",
      description: "Acceso completo a todas las funcionalidades",
      category: "Sistema"
    }
  ];

  // Group permissions by category
  const permissionsByCategory = permissionOptions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, PermissionOption[]>);

  // Initialize selected permissions when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedPermissions(new Set(currentPermissions));
    }
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    const newPermissions = new Set(selectedPermissions);
    
    if (checked) {
      // If selecting FULL access, remove all other permissions
      if (permissionKey === PERMISSIONS.FULL) {
        newPermissions.clear();
        newPermissions.add(PERMISSIONS.FULL);
      } else {
        // If selecting other permissions, remove FULL access
        newPermissions.delete(PERMISSIONS.FULL);
        newPermissions.add(permissionKey);
      }
    } else {
      newPermissions.delete(permissionKey);
    }
    
    setSelectedPermissions(newPermissions);
  };

  // Handle quick access level selection
  const handleQuickAccessLevel = (level: "read" | "write" | "full") => {
    const getPermissionsFromLevel = (level: "read" | "write" | "full"): string[] => {
      switch (level) {
        case "read":
          return [
            PERMISSIONS.CASE_VIEW,
            PERMISSIONS.DOC_READ,
            PERMISSIONS.ESCRITO_READ,
            PERMISSIONS.CLIENT_READ,
            PERMISSIONS.TEAM_READ
          ];
        case "write":  
          return [
            PERMISSIONS.CASE_VIEW,
            PERMISSIONS.CASE_EDIT,
            PERMISSIONS.DOC_READ,
            PERMISSIONS.DOC_WRITE,
            PERMISSIONS.ESCRITO_READ,
            PERMISSIONS.ESCRITO_WRITE,
            PERMISSIONS.CLIENT_READ,
            PERMISSIONS.CLIENT_WRITE,
            PERMISSIONS.TEAM_READ,
            PERMISSIONS.CHAT_ACCESS
          ];
        case "full":
          return [PERMISSIONS.FULL];
        default:
          return [PERMISSIONS.CASE_VIEW];
      }
    };

    setSelectedPermissions(new Set(getPermissionsFromLevel(level)));
  };

  const handleUpdatePermissions = async () => {
    setIsSubmitting(true);
    try {
      await updateUserPermissions({
        caseId,
        userId,
        permissions: Array.from(selectedPermissions) as Permission[]
      });

      toast.success(`Permisos actualizados para ${userName}`);
      setIsOpen(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccessLevelColor = (permissions: Set<string>) => {
    if (permissions.has(PERMISSIONS.FULL)) {
      return "bg-purple-100 text-purple-800";
    }
    
    const hasWrite = Array.from(permissions).some(p => 
      p.includes('.write') || p.includes('.delete')
    );
    
    if (hasWrite) {
      return "bg-blue-100 text-blue-800";
    }
    
    return "bg-green-100 text-green-800";
  };

  const getAccessLevelText = (permissions: Set<string>) => {
    if (permissions.has(PERMISSIONS.FULL)) {
      return "Acceso Completo";
    }
    
    const hasWrite = Array.from(permissions).some(p => 
      p.includes('.write') || p.includes('.delete')
    );
    
    if (hasWrite) {
      return "Lectura y Escritura";
    }
    
    return "Solo Lectura";
  };

  const hasChanges = () => {
    const currentSet = new Set(currentPermissions);
    if (currentSet.size !== selectedPermissions.size) return true;
    
    for (const permission of selectedPermissions) {
      if (!currentSet.has(permission)) return true;
    }
    
    return false;
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
            <Badge className={getAccessLevelColor(selectedPermissions)}>
              {getAccessLevelText(selectedPermissions)}
            </Badge>
          </div>

          {/* Quick Access Levels */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAccessLevel("read")}
              className="flex-1"
            >
              Solo Lectura
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAccessLevel("write")}
              className="flex-1"
            >
              Lectura y Escritura
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAccessLevel("full")}
              className="flex-1"
            >
              Acceso Completo
            </Button>
          </div>

          {/* Granular Permissions */}
          <div className="space-y-4">
            {Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div key={category}>
                <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div key={permission.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={permission.key}
                          checked={selectedPermissions.has(permission.key)}
                          onCheckedChange={(checked) => 
                            handlePermissionToggle(permission.key, checked as boolean)
                          }
                        />
                        <div className="flex flex-col">
                          <Label 
                            htmlFor={permission.key}
                            className="font-medium cursor-pointer"
                          >
                            {permission.label}
                          </Label>
                          <span className="text-sm text-gray-500">
                            {permission.description}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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