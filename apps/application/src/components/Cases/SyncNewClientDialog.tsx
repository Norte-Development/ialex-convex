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
import {
  UserPlus,
  Search,
  Loader2,
  Link2,
  Building2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useCase } from "../../context/CaseContext";
import { tracking } from "@/lib/tracking";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";
import {
  type NaturalezaJuridica,
  type ActividadEconomica,
  type TipoPersonaJuridica,
  type TipoSociedad,
  ACTIVIDAD_ECONOMICA_LABELS,
  TIPO_PERSONA_JURIDICA_LABELS,
  TIPO_SOCIEDAD_LABELS,
  esCuitObligatorio,
} from "../../../types/clients";

interface SyncNewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  naturalezaJuridica: NaturalezaJuridica;
  // Persona Humana
  nombre: string;
  apellido: string;
  dni: string;
  actividadEconomica: ActividadEconomica;
  profesionEspecifica: string;
  // Persona Jurídica
  razonSocial: string;
  tipoPersonaJuridica: TipoPersonaJuridica | "";
  tipoSociedad: TipoSociedad | "";
  // Comunes
  cuit: string;
  email: string;
  phone: string;
  domicilioLegal: string;
  notes: string;
}

const initialFormData: FormData = {
  naturalezaJuridica: "humana",
  nombre: "",
  apellido: "",
  dni: "",
  actividadEconomica: "sin_actividad",
  profesionEspecifica: "",
  razonSocial: "",
  tipoPersonaJuridica: "",
  tipoSociedad: "",
  cuit: "",
  email: "",
  phone: "",
  domicilioLegal: "",
  notes: "",
};

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
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // Prevent dialog closing while submitting
  const handleOpenChange = (newOpen: boolean) => {
    if (!isLinking && !isCreating) onOpenChange(newOpen);
  };

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

  const handleChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Determinar si CUIT es obligatorio
  const cuitRequired = esCuitObligatorio(
    formData.naturalezaJuridica,
    formData.actividadEconomica,
  );

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
      // Small delay to avoid portal teardown races before closing dialog
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    // Validaciones según naturaleza jurídica
    if (formData.naturalezaJuridica === "humana") {
      if (!formData.nombre.trim()) {
        toast.error("El nombre es requerido");
        return;
      }
      if (!formData.apellido.trim()) {
        toast.error("El apellido es requerido");
        return;
      }
      if (!formData.dni.trim()) {
        toast.error("El DNI es obligatorio para personas humanas");
        return;
      }
      if (cuitRequired && !formData.cuit.trim()) {
        toast.error("El CUIT es obligatorio para profesionales y comerciantes");
        return;
      }
    } else {
      if (!formData.razonSocial.trim()) {
        toast.error("La razón social es requerida");
        return;
      }
      if (!formData.cuit.trim()) {
        toast.error("El CUIT es obligatorio para personas jurídicas");
        return;
      }
    }

    setIsCreating(true);

    try {
      // Crear el cliente con el nuevo modelo
      const clientData =
        formData.naturalezaJuridica === "humana"
          ? {
              naturalezaJuridica: "humana" as const,
              nombre: formData.nombre,
              apellido: formData.apellido,
              dni: formData.dni,
              actividadEconomica: formData.actividadEconomica,
              profesionEspecifica: formData.profesionEspecifica || undefined,
              cuit: formData.cuit || undefined,
              email: formData.email || undefined,
              phone: formData.phone || undefined,
              domicilioLegal: formData.domicilioLegal || undefined,
              notes: formData.notes || undefined,
            }
          : {
              naturalezaJuridica: "juridica" as const,
              razonSocial: formData.razonSocial,
              tipoPersonaJuridica: formData.tipoPersonaJuridica || undefined,
              tipoSociedad: formData.tipoSociedad || undefined,
              cuit: formData.cuit,
              email: formData.email || undefined,
              phone: formData.phone || undefined,
              domicilioLegal: formData.domicilioLegal || undefined,
              notes: formData.notes || undefined,
            };

      const clientId = await createClient(clientData);

      // Track client creation
      tracking.clientCreated({
        clientId,
        clientType:
          formData.naturalezaJuridica === "humana" ? "individual" : "company",
      });

      // Vincular automáticamente al caso
      await addClientToCase({
        caseId: caseId as Id<"cases">,
        clientId,
        role: selectedRole,
      });

      toast.success("Cliente creado y vinculado exitosamente");

      // Reset form
      setFormData(initialFormData);
      setSelectedRole("Demandante");
      // Small delay to avoid portal teardown races before closing dialog
      await new Promise((resolve) => setTimeout(resolve, 100));
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                              {client.displayName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {client.dni && `DNI: ${client.dni}`}
                              {client.cuit && `CUIT: ${client.cuit}`}
                              {client.email && ` • ${client.email}`}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {client.naturalezaJuridica === "juridica"
                              ? "P. Jurídica"
                              : "P. Humana"}
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
              {/* Selector de Naturaleza Jurídica */}
              <div className="space-y-2">
                <Label>Naturaleza Jurídica *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={
                      formData.naturalezaJuridica === "humana"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleChange("naturalezaJuridica", "humana")}
                    className="gap-2"
                  >
                    <User className="h-4 w-4" />
                    Persona Humana
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formData.naturalezaJuridica === "juridica"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      handleChange("naturalezaJuridica", "juridica")
                    }
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Persona Jurídica
                  </Button>
                </div>
              </div>

              {formData.naturalezaJuridica === "humana" ? (
                <>
                  {/* Campos Persona Humana */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre *</Label>
                      <Input
                        id="nombre"
                        placeholder="Juan"
                        value={formData.nombre}
                        onChange={(e) => handleChange("nombre", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apellido">Apellido *</Label>
                      <Input
                        id="apellido"
                        placeholder="Pérez"
                        value={formData.apellido}
                        onChange={(e) =>
                          handleChange("apellido", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI *</Label>
                      <Input
                        id="dni"
                        placeholder="12345678"
                        value={formData.dni}
                        onChange={(e) => handleChange("dni", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Actividad Económica</Label>
                      <Select
                        value={formData.actividadEconomica}
                        onValueChange={(v) =>
                          handleChange(
                            "actividadEconomica",
                            v as ActividadEconomica,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(ACTIVIDAD_ECONOMICA_LABELS) as [
                              ActividadEconomica,
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.actividadEconomica !== "sin_actividad" && (
                    <div className="space-y-2">
                      <Label htmlFor="profesionEspecifica">
                        Profesión / Actividad específica
                      </Label>
                      <Input
                        id="profesionEspecifica"
                        placeholder="Ej: Abogado, Contador, Comerciante"
                        value={formData.profesionEspecifica}
                        onChange={(e) =>
                          handleChange("profesionEspecifica", e.target.value)
                        }
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Campos Persona Jurídica */}
                  <div className="space-y-2">
                    <Label htmlFor="razonSocial">Razón Social *</Label>
                    <Input
                      id="razonSocial"
                      placeholder="Empresa ABC S.A."
                      value={formData.razonSocial}
                      onChange={(e) =>
                        handleChange("razonSocial", e.target.value)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Persona Jurídica</Label>
                      <Select
                        value={formData.tipoPersonaJuridica}
                        onValueChange={(v) =>
                          handleChange(
                            "tipoPersonaJuridica",
                            v as TipoPersonaJuridica,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(TIPO_PERSONA_JURIDICA_LABELS) as [
                              TipoPersonaJuridica,
                              string,
                            ][]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.tipoPersonaJuridica === "sociedad" && (
                      <div className="space-y-2">
                        <Label>Tipo de Sociedad</Label>
                        <Select
                          value={formData.tipoSociedad}
                          onValueChange={(v) =>
                            handleChange("tipoSociedad", v as TipoSociedad)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.entries(TIPO_SOCIEDAD_LABELS) as [
                                TipoSociedad,
                                string,
                              ][]
                            ).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Datos de contacto comunes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cuit">
                    CUIT{" "}
                    {formData.naturalezaJuridica === "juridica" || cuitRequired
                      ? "*"
                      : "(opcional)"}
                  </Label>
                  <Input
                    id="cuit"
                    placeholder="20-12345678-9"
                    value={formData.cuit}
                    onChange={(e) => handleChange("cuit", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@email.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="+54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domicilioLegal">Domicilio Legal</Label>
                  <Input
                    id="domicilioLegal"
                    placeholder="Av. Corrientes 1234, CABA"
                    value={formData.domicilioLegal}
                    onChange={(e) =>
                      handleChange("domicilioLegal", e.target.value)
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
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                />
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
