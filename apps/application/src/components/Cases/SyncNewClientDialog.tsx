import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { UserPlus, Search, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useCase } from "../../context/CaseContext";
import { tracking } from "@/lib/tracking";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";

interface SyncNewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SyncNewClientDialog({
  open,
  onOpenChange,
}: SyncNewClientDialogProps) {
  const { caseId } = useCase();
  const [activeTab, setActiveTab] = useState("link");

  // Estados para vincular
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] =
    useState<Id<"clients"> | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("Demandante");
  const [isLinking, setIsLinking] = useState(false);

  // Estados para crear
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dni: "",
    cuit: "",
    address: "",
    clientType: "individual" as "individual" | "company",
    notes: "",
  });

  // Obtener todos los clientes
  const allClientsResult = useQuery(api.functions.clients.getClients, {
    search: searchTerm,
  });

  // Obtener clientes ya vinculados al caso
  const linkedClientsResult = useQuery(
    api.functions.cases.getClientsForCase,
    caseId ? { caseId } : "skip",
  );

  // Mutations
  const addClientToCase = useMutation(api.functions.cases.addClientToCase);
  const createClient = useMutation(api.functions.clients.createClient);

  // Filtrar clientes no vinculados
  const availableClients = useMemo(() => {
    if (!allClientsResult?.page || !linkedClientsResult) return [];

    const linkedClientIds = new Set(
      linkedClientsResult.map((client: any) => client._id),
    );

    return allClientsResult.page.filter(
      (client: any) => !linkedClientIds.has(client._id),
    );
  }, [allClientsResult, linkedClientsResult]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLinkClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      toast.error("Por favor selecciona un cliente");
      return;
    }

    if (!selectedRole) {
      toast.error("Por favor selecciona un rol");
      return;
    }

    setIsLinking(true);

    try {
      await addClientToCase({
        caseId: caseId as Id<"cases">,
        clientId: selectedClientId,
        role: selectedRole,
      });

      toast.success("Cliente vinculado exitosamente");
      // Close any open floating layers before closing dialog to prevent NotFoundError
      closeFloatingLayers();
      onOpenChange(false);
      setSearchTerm("");
      setSelectedClientId(null);
      setSelectedRole("Demandante");
    } catch (error) {
      console.error("Error linking client:", error);
      toast.error("Error al vincular el cliente: " + (error as Error).message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    // Validación según tipo de cliente
    if (formData.clientType === "individual" && !formData.dni.trim()) {
      toast.error("El DNI es requerido para personas físicas");
      return;
    }

    if (formData.clientType === "company" && !formData.cuit.trim()) {
      toast.error("El CUIT es requerido para empresas");
      return;
    }

    setIsCreating(true);

    try {
      // Crear el cliente
      const clientData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        dni: formData.dni || undefined,
        cuit: formData.cuit || undefined,
        address: formData.address || undefined,
        clientType: formData.clientType,
        notes: formData.notes || undefined,
      };

      const clientId = await createClient(clientData);

      // Track client creation
      tracking.clientCreated({
        clientId,
        clientType: formData.clientType,
      });

      // Vincular automáticamente al caso
      await addClientToCase({
        caseId: caseId as Id<"cases">,
        clientId,
        role: selectedRole,
      });

      toast.success("Cliente creado y vinculado exitosamente");

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        dni: "",
        cuit: "",
        address: "",
        clientType: "individual",
        notes: "",
      });
      setSelectedRole("Demandante");
      // Close any open floating layers before closing dialog to prevent NotFoundError
      closeFloatingLayers();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating and linking client:", error);
      toast.error(
        "Error al crear y vincular el cliente: " + (error as Error).message,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleClientClick = (clientId: Id<"clients">) => {
    setSelectedClientId(selectedClientId === clientId ? null : clientId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Cliente del Caso</DialogTitle>
          <DialogDescription>
            Vincula un cliente existente o crea uno nuevo y vincúlalo
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Vincular Existente
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Crear Nuevo
            </TabsTrigger>
          </TabsList>

          {/* Tab de Vincular */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <form onSubmit={handleLinkClient} className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <Input
                  placeholder="Buscar clientes disponibles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Clientes disponibles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Clientes disponibles:
                </Label>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {!allClientsResult ? (
                    <div className="p-4 text-center text-gray-500">
                      Cargando clientes...
                    </div>
                  ) : availableClients.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {searchTerm
                        ? "No se encontraron clientes"
                        : "Todos los clientes están vinculados"}
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {availableClients.map((client: any) => (
                        <div
                          key={client._id}
                          onClick={() => handleClientClick(client._id)}
                          className={`flex items-center space-x-3 p-3 hover:bg-gray-50 rounded cursor-pointer border-2 transition-colors ${
                            selectedClientId === client._id
                              ? "border-primary bg-primary/5"
                              : "border-transparent"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {client.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {client.dni && `DNI: ${client.dni}`}
                              {client.cuit && `CUIT: ${client.cuit}`}
                              {client.email && ` • ${client.email}`}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {client.clientType === "individual"
                              ? "Persona"
                              : "Empresa"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rol del cliente */}
              {selectedClientId && (
                <div className="space-y-2">
                  <Label>Rol en el Caso *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Demandante">Demandante</SelectItem>
                      <SelectItem value="Demandado">Demandado</SelectItem>
                      <SelectItem value="Testigo">Testigo</SelectItem>
                      <SelectItem value="Representante Legal">
                        Representante Legal
                      </SelectItem>
                      <SelectItem value="Tercero Interesado">
                        Tercero Interesado
                      </SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLinking}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLinking || !selectedClientId}>
                  {isLinking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    "Vincular Cliente"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Tab de Crear */}
          <TabsContent value="create" className="space-y-4 mt-4">
            <form onSubmit={handleCreateAndLink} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Nombre */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo / Razón Social *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Juan Pérez / Empresa ABC S.A."
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                </div>

                {/* Tipo de Cliente */}
                <div className="space-y-2">
                  <Label>Tipo de Cliente *</Label>
                  <Select
                    value={formData.clientType}
                    onValueChange={(value) =>
                      handleInputChange("clientType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Persona Física</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* DNI/CUIT según tipo */}
                <div className="grid grid-cols-2 gap-4">
                  {formData.clientType === "individual" ? (
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI *</Label>
                      <Input
                        id="dni"
                        placeholder="Ej: 12345678"
                        value={formData.dni}
                        onChange={(e) =>
                          handleInputChange("dni", e.target.value)
                        }
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cuit">CUIT *</Label>
                      <Input
                        id="cuit"
                        placeholder="Ej: 20-12345678-9"
                        value={formData.cuit}
                        onChange={(e) =>
                          handleInputChange("cuit", e.target.value)
                        }
                        required
                      />
                    </div>
                  )}

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Ej: cliente@email.com"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Teléfono y Dirección */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      placeholder="Ej: +54 11 1234-5678"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      placeholder="Ej: Av. Corrientes 1234, CABA"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Rol en el caso */}
                <div className="space-y-2">
                  <Label>Rol en el Caso *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Demandante">Demandante</SelectItem>
                      <SelectItem value="Demandado">Demandado</SelectItem>
                      <SelectItem value="Testigo">Testigo</SelectItem>
                      <SelectItem value="Representante Legal">
                        Representante Legal
                      </SelectItem>
                      <SelectItem value="Tercero Interesado">
                        Tercero Interesado
                      </SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notas */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    placeholder="Notas adicionales sobre el cliente..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear y Vincular"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
