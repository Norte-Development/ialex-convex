import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { UserPlus, Search, User, Mail } from "lucide-react";

interface AddMemberDialogProps {
  teamId: string;
  onClose: () => void;
}

export default function AddMemberDialog({
  teamId,
  onClose,
}: AddMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<
    "secretario" | "abogado" | "admin"
  >("secretario");

  const addUserToTeam = useMutation(api.functions.teams.addUserToTeam);

  const [foundUser, setFoundUser] = useState<any>(null);

  const handleSearchUser = async () => {
    if (!searchEmail.trim()) {
      alert("Por favor ingresa un email para buscar");
      return;
    }

    // Simulación de búsqueda - falta implementar alguna query para buscar usuario por email o algo similar
    setFoundUser({
      _id: "temp_user_id",
      name: "Usuario Encontrado",
      email: searchEmail,
    });
    setSelectedUserId("temp_user_id");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      alert("Por favor busca y selecciona un usuario");
      return;
    }

    if (!selectedRole) {
      alert("Por favor selecciona un rol");
      return;
    }

    setIsLoading(true);
    try {
      await addUserToTeam({
        teamId: teamId as any,
        userId: selectedUserId as any,
        role: selectedRole,
      });

      alert("Miembro agregado exitosamente");
      onClose();
    } catch (error) {
      console.error("Error adding member:", error);
      alert(
        "Error al agregar el miembro. Puede que ya sea miembro del equipo o no tengas permisos.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Agregar Miembro al Equipo
          </DialogTitle>
          <DialogDescription>
            Busca un usuario por email y agrégalo al equipo con el rol
            apropiado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search User Section */}
          <div className="space-y-2">
            <Label htmlFor="email">Buscar Usuario por Email</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchUser}
                disabled={isLoading}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Found User Display */}
          {foundUser && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">{foundUser.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-3 h-3" />
                    {foundUser.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Rol en el Equipo</Label>
            <Select
              value={selectedRole}
              onValueChange={(value: any) => setSelectedRole(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretario">Secretario</SelectItem>
                <SelectItem value="abogado">Abogado</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Descriptions */}
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-2">Roles disponibles:</p>
            <ul className="space-y-1">
              <li>
                <strong>Secretario:</strong> Acceso básico al equipo
              </li>
              <li>
                <strong>Abogado:</strong> Acceso completo a casos del equipo
              </li>
              <li>
                <strong>Administrador:</strong> Puede gestionar miembros del
                equipo
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !selectedUserId}>
              {isLoading ? "Agregando..." : "Agregar Miembro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
