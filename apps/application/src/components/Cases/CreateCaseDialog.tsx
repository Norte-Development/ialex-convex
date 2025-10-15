import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Plus, Users, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { useBillingLimit, UpgradeModal, LimitWarningBanner } from "@/components/Billing";
import { toast } from "sonner";

export default function CreateCaseDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState<
    {
      id: Id<"clients">;
      name: string;
      role?: string;
    }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");

  const createCase = useMutation(api.functions.cases.createCase);
  const addClientToCase = useMutation(api.functions.cases.addClientToCase);
  const clientsResult = useQuery(api.functions.clients.getClients, {});

  const clients = clientsResult?.page || [];

  // Check case limit
  const { allowed, isWarning, percentage, reason, currentCount, limit } = 
    useBillingLimit("cases", {});

  // Get user plan for upgrade modal
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.dni?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.cuit?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    category: "",
    estimatedHours: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClientToggle = (client: { _id: Id<"clients">; name: string }) => {
    setSelectedClients((prev) => {
      const isSelected = prev.some((c) => c.id === client._id);
      if (isSelected) {
        return prev.filter((c) => c.id !== client._id);
      } else {
        return [...prev, { id: client._id, name: client.name, role: "" }];
      }
    });
  };

  const handleClientRoleChange = (clientId: Id<"clients">, role: string) => {
    setSelectedClients((prev) =>
      prev.map((client) =>
        client.id === clientId ? { ...client, role } : client,
      ),
    );
  };

  const removeClient = (clientId: Id<"clients">) => {
    setSelectedClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert("El título es requerido");
      return;
    }

    // Check billing limit before creating case
    if (!allowed) {
      toast.error("Límite alcanzado", {
        description: reason,
      });
      setShowUpgradeModal(true);
      return;
    }

    setIsLoading(true);

    try {
      const caseData = {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        category: formData.category || undefined,
        estimatedHours: formData.estimatedHours
          ? Number(formData.estimatedHours)
          : undefined,
      };

      const caseId = await createCase(caseData);

      // Vincular clientes al caso
      if (selectedClients.length > 0) {
        await Promise.all(
          selectedClients.map((client) =>
            addClientToCase({
              clientId: client.id,
              caseId: caseId,
              role: client.role || undefined,
            }),
          ),
        );
        console.log(`Linked ${selectedClients.length} clients to case`);
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        category: "",
        estimatedHours: "",
      });
      setSelectedClients([]);

      setOpen(false);
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Error al crear el caso: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    "Derecho Civil",
    "Derecho Penal",
    "Derecho Laboral",
    "Derecho Comercial",
    "Derecho de Familia",
    "Derecho Inmobiliario",
    "Derecho Administrativo",
    "Derecho Tributario",
  ];

  const clientRoles = [
    "Demandante",
    "Demandado",
    "Testigo",
    "Representante Legal",
    "Tercero Interesado",
    "Otro",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" />
          Nuevo Caso
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Crear Nuevo Caso</DialogTitle>
              <DialogDescription>
                Complete la información para crear un nuevo caso legal y vincule los
                clientes correspondientes.
              </DialogDescription>
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
              Casos: {currentCount}/{limit === Infinity ? "∞" : limit}
            </span>
          </div>
        </DialogHeader>

        {/* Warning banner if approaching limit */}
        {isWarning && (
          <LimitWarningBanner
            limitType="cases"
            percentage={percentage}
            currentCount={currentCount}
            limit={limit}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título del Caso *</Label>
              <Input
                id="title"
                placeholder="Ej: Divorcio Consensuado - García vs García"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Descripción detallada del caso..."
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                rows={3}
              />
            </div>

            {/* Prioridad y Categoría */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    handleInputChange("priority", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    handleInputChange("category", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Horas estimadas */}
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Horas Estimadas</Label>
              <Input
                id="estimatedHours"
                type="number"
                placeholder="Ej: 40"
                value={formData.estimatedHours}
                onChange={(e) =>
                  handleInputChange("estimatedHours", e.target.value)
                }
                min="1"
              />
            </div>

            {/* Clientes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <Label>Clientes Vinculados</Label>
                <span className="text-sm text-muted-foreground">
                  ({selectedClients.length} seleccionados)
                </span>
              </div>

              {/* Clientes seleccionados */}
              {selectedClients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Clientes Seleccionados:
                  </Label>
                  <div className="space-y-2">
                    {selectedClients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-2 p-2 border rounded-md bg-muted/50"
                      >
                        <Badge variant="secondary" className="flex-shrink-0">
                          {client.name}
                        </Badge>
                        <Select
                          value={client.role || ""}
                          onValueChange={(value) =>
                            handleClientRoleChange(client.id, value)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Rol" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeClient(client.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de clientes disponibles */}
              {clients && clients.length > 0 && (
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar cliente"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <Label className="text-sm font-medium">
                    Seleccionar Clientes:
                  </Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {filteredClients.map((client) => {
                      const isSelected = selectedClients.some(
                        (c) => c.id === client._id,
                      );
                      return (
                        <div
                          key={client._id}
                          className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded"
                        >
                          <Checkbox
                            id={client._id}
                            checked={isSelected}
                            onCheckedChange={() => handleClientToggle(client)}
                          />
                          <Label
                            htmlFor={client._id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {client.name}
                            {client.dni && (
                              <span className="text-muted-foreground ml-2">
                                DNI: {client.dni}
                              </span>
                            )}
                            {client.cuit && (
                              <span className="text-muted-foreground ml-2">
                                CUIT: {client.cuit}
                              </span>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {clients && clients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay clientes disponibles. Cree clientes primero para
                  vincularlos al caso.
                </p>
              )}
            </div>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear Caso"}
            </Button>
          </DialogFooter>
        </form>

        {/* Upgrade Modal */}
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          reason={reason}
          currentPlan={userPlan || "free"}
          recommendedPlan="premium_individual"
        />
      </DialogContent>
    </Dialog>
  );
}
