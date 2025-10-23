import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { FeatureLock, UpgradeModal } from "@/components/Billing";
import { toast } from "sonner";

export default function CreateTeamDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const createTeam = useMutation(api.functions.teams.createTeam);

  // Check team creation access (validates plan and ownership limit)
  const user = useQuery(api.functions.users.getCurrentUser, {});
  const canCreateTeamCheck = useQuery(
    api.billing.features.canCreateTeam,
    user?._id ? { userId: user._id } : "skip",
  );

  // Get user plan for upgrade modal
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    user?._id ? { userId: user._id } : "skip",
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("El nombre del equipo es obligatorio");
      return;
    }

    // Check billing limit before creating team
    if (!canCreateTeamCheck?.allowed) {
      toast.error("No puedes crear un equipo", {
        description:
          canCreateTeamCheck?.reason || "No tienes acceso a crear equipos",
      });
      // Only show upgrade modal if upgrading would actually help
      if (canCreateTeamCheck?.canUpgrade) {
        setShowUpgradeModal(true);
      }
      return;
    }

    setIsLoading(true);
    try {
      await createTeam({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });

      setFormData({
        name: "",
        description: "",
      });
      setOpen(false);

      alert("Equipo creado exitosamente");
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Error al crear el equipo. Por favor, intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <FeatureLock
          feature="create_team"
          onUpgrade={() => setShowUpgradeModal(true)}
        >
          <Button
            onClick={() => setOpen(true)}
            className=" text-white cursor-pointer"
          >
            Añadir equipo
          </Button>
        </FeatureLock>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Equipo</DialogTitle>
          <DialogDescription>
            Crea un nuevo equipo para organizar a los miembros de tu
            organización.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Equipo *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Ej: Equipo Legal Corporativo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Descripción opcional del equipo y sus responsabilidades"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="text-white cursor-pointer"
            >
              {isLoading ? "Creando..." : "Crear Equipo"}
            </Button>
          </DialogFooter>
        </form>

        {/* Upgrade Modal - only render if upgrade would help */}
        {canCreateTeamCheck?.canUpgrade && (
          <UpgradeModal
            open={showUpgradeModal}
            onOpenChange={setShowUpgradeModal}
            reason={canCreateTeamCheck?.reason || "Funcionalidad no disponible"}
            currentPlan={userPlan || "free"}
            recommendedPlan="premium_individual"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
