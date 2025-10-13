import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface AddParticipantDialogProps {
  eventId: Id<"events">;
  existingParticipants: Array<{ userId: Id<"users"> }>;
}

export default function AddParticipantDialog({
  eventId,
  existingParticipants,
}: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [role, setRole] = useState<string>("participante");

  // Query para buscar usuarios
  const searchResults = useQuery(
    api.functions.users.searchUsers,
    searchTerm.length >= 2 ? { searchTerm } : "skip"
  );

  const addParticipant = useMutation(api.functions.events.addParticipant);

  // Filtrar usuarios que ya son participantes
  const existingUserIds = existingParticipants.map((p) => p.userId);
  const availableUsers = searchResults?.filter(
    (user) => !existingUserIds.includes(user._id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!selectedUserId) {
        toast.error("Selecciona un usuario");
        setIsLoading(false);
        return;
      }

      await addParticipant({
        eventId,
        userId: selectedUserId as Id<"users">,
        role: role as any,
      });

      toast.success("Participante agregado exitosamente");
      setSearchTerm("");
      setSelectedUserId("");
      setRole("participante");
      setOpen(false);
    } catch (error) {
      console.error("Error adding participant:", error);
      toast.error("No se pudo agregar el participante");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <UserPlus size={16} className="mr-2" />
          Agregar Participante
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Participante</DialogTitle>
          <DialogDescription>
            Invita a otros usuarios a este evento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Búsqueda de usuarios */}
          <div className="space-y-2">
            <Label htmlFor="searchTerm">
              Buscar Usuario <span className="text-red-500">*</span>
            </Label>
            <Input
              id="searchTerm"
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedUserId(""); // Reset selection on new search
              }}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Escribe al menos 2 caracteres para buscar
            </p>
          </div>

          {/* Selector de usuario */}
          {searchTerm.length >= 2 && (
            <div className="space-y-2">
              <Label htmlFor="userId">
                Seleccionar Usuario <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar de los resultados..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers && availableUsers.length > 0 ? (
                    availableUsers.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))
                  ) : searchResults ? (
                    <SelectItem value="none" disabled>
                      Todos los usuarios ya son participantes
                    </SelectItem>
                  ) : (
                    <SelectItem value="none" disabled>
                      No se encontraron usuarios
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Rol */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Rol <span className="text-red-500">*</span>
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participante">Participante</SelectItem>
                <SelectItem value="opcional">Opcional</SelectItem>
                <SelectItem value="organizador">Organizador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "organizador" &&
                "Puede editar y gestionar el evento"}
              {role === "participante" && "Asistencia requerida"}
              {role === "opcional" && "Asistencia opcional"}
            </p>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !selectedUserId}>
              {isLoading ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
