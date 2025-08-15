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
import { Badge } from "@/components/ui/badge";

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

  const sendTeamInvite = useMutation(api.functions.teams.sendTeamInvite);

  const foundUser = useQuery(api.functions.users.getUserByEmail, {
    email: email,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor ingresa un email válido");
      return;
    }

    setIsLoading(true);
    try {
      await sendTeamInvite({
        teamId: teamId as any,
        email: email.trim(),
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
      console.error("Error processing invitation:", error);
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
                <Badge className="text-xs text-blue-600 bg-blue-50 p-2 rounded-md mt-2 w-full  flex flex-col">
                  Este usuario no está registrado.
                  <strong>Se le enviará una invitación para unirse.</strong>
                </Badge>
              )}
              {foundUser && (
                <Badge className="text-xs text-green-600 bg-green-50 p-2 rounded-md mt-2 w-full flex flex-col">
                  Este usuario ya está en la plataforma.{" "}
                  <strong>
                    Se le enviará una invitación para unirse al equipo.
                  </strong>
                </Badge>
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
              <Button
                type="submit"
                disabled={isLoading || !email.includes("@")}
                className="cursor-pointer"
              >
                {isLoading ? "Enviando..." : "Enviar Invitación"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
