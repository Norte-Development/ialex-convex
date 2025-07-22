import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { UserPlus } from "lucide-react";

interface InviteUserDialogProps {
  teamId: string;
  onClose?: () => void;
}

export default function InviteUserDialog({
  teamId,
  onClose,
}: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"secretario" | "abogado" | "admin">(
    "secretario",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addUserToTeam = useMutation(api.functions.teams.addUserToTeam);

  const foundUser = useQuery(api.functions.users.getUserByEmail, {
    email: email,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!foundUser) {
      setError(
        "No se ha encontrado un usuario con ese email. Verifíquelo antes de invitar.",
      );
      return;
    }

    setIsLoading(true);
    try {
      await addUserToTeam({
        teamId: teamId as any,
        userId: foundUser._id,
        role: role,
      });

      setSuccess(true);

      setTimeout(() => {
        setEmail("");
        setRole("secretario");
        setSuccess(false);
        setOpen(false);
        onClose?.();
      }, 2000);
    } catch (error) {
      console.error("Error sending invitation:", error);
      const errorMessage =
        (error as any)?.data?.message || (error as Error).message;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setRole("secretario");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Invitar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invitar Usuario al Equipo</DialogTitle>
            <DialogDescription>
              Envía una invitación por email para que se una al equipo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ¡Invitación enviada exitosamente!
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || success}
              />
              {email.length > 3 && foundUser === null && (
                <p className="text-xs text-yellow-600">
                  No se encontró un usuario con este email.
                </p>
              )}
              {foundUser && (
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded-md">
                  Usuario encontrado: <strong>{foundUser.name}</strong>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Rol en el equipo *</Label>
              <Select
                value={role}
                onValueChange={(value: any) => setRole(value)}
                disabled={isLoading || success}
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            {!success && (
              <Button type="submit" disabled={isLoading || !foundUser}>
                {isLoading ? "Enviando..." : "Enviar Invitación"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
