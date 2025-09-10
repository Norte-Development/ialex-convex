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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserPlus, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

type AccessLevel = "none" | "basic" | "advanced" | "admin";

interface IndividualUserPermissionsDialogProps {
  caseId: Id<"cases">;
  trigger?: React.ReactNode;
}

export default function IndividualUserPermissionsDialog({
  caseId,
  trigger,
}: IndividualUserPermissionsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    _id: Id<"users">;
    name: string;
    email: string;
  } | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Debug logging
  console.log("IndividualUserPermissionsDialog - caseId:", caseId);
  console.log("IndividualUserPermissionsDialog - isOpen:", isOpen);

  // Get available users for this case (combines search + filtering in one efficient query)
  const availableUsers = useQuery(
    api.functions.users.searchAvailableUsersForCase,
    { searchTerm: searchTerm.trim(), caseId },
  );

  // Get current individual case permissions
  const currentPermissions = useQuery(
    api.functions.permissions.getNewUsersWithCaseAccess,
    { caseId },
  );

  // Mutations
  const addIndividualPermission = useMutation(
    api.functions.permissions.grantNewUserCaseAccess,
  );
  const removeIndividualPermission = useMutation(
    api.functions.permissions.revokeNewUserCaseAccess,
  );

  const handleAddPermission = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await addIndividualPermission({
        caseId,
        userId: selectedUser._id,
        accessLevel: accessLevel,
      });

      toast.success(
        `Nivel de acceso ${accessLevel} otorgado a ${selectedUser.name}`,
      );
      setSelectedUser(null);
      setAccessLevel("basic");
      setSearchTerm(""); // Clear search after adding
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePermission = async (
    userId: Id<"users">,
    userName: string,
  ) => {
    try {
      await removeIndividualPermission({
        caseId,
        userId,
      });
      toast.success(`Permisos removidos de ${userName}`);
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const getAccessLevelLabel = (level: AccessLevel) => {
    switch (level) {
      case "none":
        return "Sin Acceso";
      case "basic":
        return "Básico";
      case "advanced":
        return "Avanzado";
      case "admin":
        return "Administrador";
      default:
        return "Básico";
    }
  };

  const getAccessLevelColor = (level: AccessLevel) => {
    switch (level) {
      case "none":
        return "bg-gray-100 text-gray-800";
      case "basic":
        return "bg-green-100 text-green-800";
      case "advanced":
        return "bg-blue-100 text-blue-800";
      case "admin":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Gestionar Permisos Individuales
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Permisos Individuales de Usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Permission */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Agregar Permisos de Usuario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-search">Buscar Usuario</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="user-search"
                      placeholder="Buscar por nombre o email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchTerm.trim().length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="user-select">Seleccionar Usuario</Label>
                      <Select
                        value={selectedUser?._id || ""}
                        onValueChange={(userId) => {
                          const user = availableUsers?.find(
                            (u) => u._id === userId,
                          );
                          setSelectedUser(user || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar usuario" />
                        </SelectTrigger>
                        <SelectContent>
                          {!availableUsers || availableUsers.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-gray-500">
                              {searchTerm.trim().length === 0
                                ? "Escribe para buscar usuarios"
                                : "No se encontraron usuarios disponibles"}
                            </div>
                          ) : (
                            (availableUsers || []).map((user) => (
                              <SelectItem key={user._id} value={user._id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {user.name}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {user.email}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="access-level">Nivel de Acceso</Label>
                  <Select
                    value={accessLevel}
                    onValueChange={(value: AccessLevel) =>
                      setAccessLevel(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="advanced">Avanzado</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleAddPermission}
                    disabled={!selectedUser || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Agregar Permisos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Permisos Actuales</CardTitle>
            </CardHeader>
            <CardContent>
              {currentPermissions === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Cargando permisos...
                </div>
              ) : currentPermissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay permisos individuales configurados
                </div>
              ) : (
                <div className="space-y-3">
                  {currentPermissions.map((permission) => (
                    <div
                      key={permission.userId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {permission.user?.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {permission.user?.email}
                          </span>
                        </div>
                        <Badge
                          className={getAccessLevelColor(
                            permission.accessLevel,
                          )}
                        >
                          {getAccessLevelLabel(permission.accessLevel)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-sm text-gray-500">
                          Nivel {permission.accessLevel}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleRemovePermission(
                              permission.userId,
                              permission.user?.name || "Usuario",
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
