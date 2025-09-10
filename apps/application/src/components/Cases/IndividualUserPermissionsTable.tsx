import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Trash2, Edit, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EditUserPermissionsDialog from "./EditUserPermissionsDialog";

interface IndividualUserPermissionsTableProps {
  caseId: Id<"cases">;
}

interface UserWithAccess {
  userId: Id<"users">;
  accessLevel: "none" | "basic" | "advanced" | "admin";
  grantedAt: number;
  grantedBy: Id<"users">;
  expiresAt?: number;
  user: {
    _id: Id<"users">;
    email: string;
    name: string;
  };
}

export function IndividualUserPermissionsTable({
  caseId,
}: IndividualUserPermissionsTableProps) {
  const [userToDelete, setUserToDelete] = useState<UserWithAccess | null>(null);

  // Get users with individual case access
  const usersWithAccess = useQuery(
    api.functions.permissions.getNewUsersWithCaseAccess,
    { caseId },
  );

  // Mutation to revoke user access
  const revokeAccess = useMutation(
    api.functions.permissions.revokeNewUserCaseAccess,
  );

  const handleRevokeAccess = async (userId: Id<"users">) => {
    try {
      await revokeAccess({ caseId, userId });
      setUserToDelete(null);
    } catch (error) {
      console.error("Error revoking access:", error);
      // You could add a toast notification here
    }
  };

  const getAccessLevelDisplay = (
    accessLevel: "none" | "basic" | "advanced" | "admin",
  ) => {
    switch (accessLevel) {
      case "admin":
        return {
          level: "Administrador",
          color: "bg-purple-100 text-purple-800",
        };
      case "advanced":
        return { level: "Acceso Avanzado", color: "bg-blue-100 text-blue-800" };
      case "basic":
        return { level: "Acceso Básico", color: "bg-green-100 text-green-800" };
      case "none":
        return { level: "Sin Acceso", color: "bg-gray-100 text-gray-800" };
      default:
        return { level: "Sin Acceso", color: "bg-gray-100 text-gray-800" };
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAccessLevelDescription = (
    accessLevel: "none" | "basic" | "advanced" | "admin",
  ) => {
    switch (accessLevel) {
      case "admin":
        return "Acceso completo incluyendo gestión de equipos y permisos";
      case "advanced":
        return "Incluye acceso básico + edición de documentos y escritos";
      case "basic":
        return "Puede ver información del caso, documentos y escritos (solo lectura)";
      case "none":
        return "Sin acceso al caso";
      default:
        return "Sin acceso al caso";
    }
  };

  if (usersWithAccess === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nivel de Acceso</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead>Otorgado</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (!usersWithAccess || usersWithAccess.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay usuarios individuales
        </h3>
        <p className="text-gray-500">
          No se han otorgado permisos individuales para este caso.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Nivel de Acceso</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead>Otorgado</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersWithAccess.map((userAccess) => {
              // Skip entries without userId (should not happen but safety check)
              if (!userAccess.userId) return null;

              const accessLevelDisplay = getAccessLevelDisplay(
                userAccess.accessLevel,
              );

              return (
                <TableRow key={userAccess.userId}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium">
                          {userAccess.user.name || "Sin nombre"}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {userAccess.user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={accessLevelDisplay.color}
                    >
                      {accessLevelDisplay.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {getAccessLevelDescription(userAccess.accessLevel)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {formatDate(userAccess.grantedAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <EditUserPermissionsDialog
                        caseId={caseId}
                        userId={userAccess.userId}
                        userName={userAccess.user.name || "Sin nombre"}
                        userEmail={userAccess.user.email}
                        currentAccessLevel={userAccess.accessLevel}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar Permisos"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUserToDelete(userAccess)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Revocar Acceso"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Revocar acceso?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres revocar el acceso de{" "}
              <strong>
                {userToDelete?.user.name || userToDelete?.user.email}
              </strong>{" "}
              a este caso? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                userToDelete &&
                userToDelete.userId &&
                handleRevokeAccess(userToDelete.userId)
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revocar Acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
