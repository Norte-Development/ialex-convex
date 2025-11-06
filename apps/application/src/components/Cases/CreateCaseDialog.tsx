import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
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
import { Plus, Users, X, Calendar } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  useBillingLimit,
  UpgradeModal,
  LimitWarningBanner,
} from "@/components/Billing";
import { Separator } from "../ui/separator";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";

export default function CreateCaseDialog() {
  // Hooks
  const navigate = useNavigate();

  // All useState hooks first
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    expedientNumber: "",
    priority: "medium" as "low" | "medium" | "high",
    category: "",
    estimatedHours: "",
  });
  const [deadlines, setDeadlines] = useState<
    Array<{
      id: string;
      title: string;
      date: string;
      time: string;
      type: "audiencia" | "plazo" | "presentacion" | "otro";
    }>
  >([]);
  const [showDeadlineForm, setShowDeadlineForm] = useState(false);

  // Then all mutations
  const createCase = useMutation(api.functions.cases.createCase);
  const addClientToCase = useMutation(api.functions.cases.addClientToCase);
  const createEvent = useMutation(api.functions.events.createEvent);

  // Then all queries
  const clientsResult = useQuery(api.functions.clients.getClients, {});

  // Get current user first - useBillingLimit also needs this
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});

  // Get user plan
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  // Then custom hooks (useBillingLimit uses useQuery internally)
  // Note: useBillingLimit will return safe defaults if currentUser is not loaded yet
  const { allowed, isWarning, percentage, reason, currentCount, limit } =
    useBillingLimit("cases", {});

  // Derived values
  const clients = clientsResult?.page || [];
  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.dni?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.cuit?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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

  const addDeadline = () => {
    const newDeadline = {
      id: Date.now().toString(),
      title: "",
      date: "",
      time: "09:00",
      type: "plazo" as const,
    };
    setDeadlines((prev) => [...prev, newDeadline]);
    setShowDeadlineForm(true);
  };

  const updateDeadline = (id: string, field: string, value: string) => {
    setDeadlines((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );
  };

  const removeDeadline = (id: string) => {
    setDeadlines((prev) => prev.filter((d) => d.id !== id));
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
        expedientNumber: formData.expedientNumber || undefined,
        priority: formData.priority,
        category: formData.category || undefined,
        estimatedHours: formData.estimatedHours
          ? Number(formData.estimatedHours)
          : undefined,
      };

      const caseId = await createCase(caseData);

      // Track case creation
      tracking.caseCreated({
        caseId,
        category: formData.category,
        priority: formData.priority,
        status: "pendiente",
      });

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

      // Crear eventos para las fechas límite
      if (deadlines.length > 0) {
        const validDeadlines = deadlines.filter((d) => d.date && d.title);

        if (validDeadlines.length > 0) {
          await Promise.all(
            validDeadlines.map((deadline) => {
              const startDateTime = new Date(
                `${deadline.date}T${deadline.time}`,
              );
              const endDateTime = new Date(startDateTime);
              endDateTime.setHours(endDateTime.getHours() + 1); // 1 hora de duración por defecto

              return createEvent({
                title: deadline.title,
                description: `Fecha límite del caso: ${formData.title}`,
                caseId: caseId as any,
                eventType: deadline.type as any,
                startDate: startDateTime.getTime(),
                endDate: endDateTime.getTime(),
                allDay: false,
                isVirtual: false,
                reminderMinutes: [1440, 60, 15], // 1 día, 1 hora, 15 min antes
              });
            }),
          );
          toast.success(`Caso creado con ${validDeadlines.length} evento(s)`);
        } else {
          toast.success("Caso creado exitosamente");
        }
      } else {
        toast.success("Caso creado exitosamente");
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        expedientNumber: "",
        priority: "medium",
        category: "",
        estimatedHours: "",
      });
      setSelectedClients([]);
      setDeadlines([]);
      setShowDeadlineForm(false);

      // Close any open floating layers before closing dialog to prevent NotFoundError
      closeFloatingLayers();
      setOpen(false);

      // Navigate to the created case
      navigate(`/caso/${caseId}`);

      // Dispatch custom event for tutorial
      window.dispatchEvent(
        new CustomEvent("tutorial:caseCreated", {
          detail: { caseId },
        }),
      );
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
      <DialogTrigger asChild data-tutorial="create-case">
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
                Complete la información para crear un nuevo caso legal y vincule
                los clientes correspondientes.
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
                data-tutorial="case-form-title"
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

            {/* Número de Expediente */}
            <div className="space-y-2">
              <Label htmlFor="expedientNumber">Número de Expediente</Label>
              <Input
                id="expedientNumber"
                placeholder="Ej: EXP-2024-12345 o 12345/2024"
                value={formData.expedientNumber}
                onChange={(e) =>
                  handleInputChange("expedientNumber", e.target.value)
                }
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

            {/* Separador */}
            <Separator className="my-4" />

            {/* Fechas Límite / Eventos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <Label>Fechas Límite (Opcional)</Label>
                  <span className="text-sm text-muted-foreground">
                    ({deadlines.length} fecha{deadlines.length !== 1 ? "s" : ""}
                    )
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDeadline}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar Fecha
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Las fechas límite se crearán automáticamente como eventos
                vinculados al caso
              </p>

              {/* Lista de fechas límite */}
              {deadlines.length > 0 && (
                <div className="space-y-3">
                  {deadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className="p-3 border rounded-md bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Evento</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDeadline(deadline.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {/* Título del evento */}
                        <Input
                          placeholder="Ej: Presentación de demanda"
                          value={deadline.title}
                          onChange={(e) =>
                            updateDeadline(deadline.id, "title", e.target.value)
                          }
                          className="text-sm"
                        />

                        {/* Tipo de evento */}
                        <Select
                          value={deadline.type}
                          onValueChange={(value) =>
                            updateDeadline(deadline.id, "type", value)
                          }
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="audiencia">
                              🏛️ Audiencia
                            </SelectItem>
                            <SelectItem value="plazo">
                              ⏰ Plazo Legal
                            </SelectItem>
                            <SelectItem value="presentacion">
                              📄 Presentación
                            </SelectItem>
                            <SelectItem value="otro">📌 Otro</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Fecha y hora */}
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={deadline.date}
                            onChange={(e) =>
                              updateDeadline(
                                deadline.id,
                                "date",
                                e.target.value,
                              )
                            }
                            className="text-sm"
                          />
                          <Input
                            type="time"
                            value={deadline.time}
                            onChange={(e) =>
                              updateDeadline(
                                deadline.id,
                                "time",
                                e.target.value,
                              )
                            }
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
            <Button
              type="submit"
              disabled={isLoading}
              data-tutorial="case-form-submit"
            >
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
