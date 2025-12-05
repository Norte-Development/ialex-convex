import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";

interface NewClientSectionProps {
  onClientCreated: (client: {
    id: Id<"clients">;
    name: string;
    role?: string;
  }) => void;
  renderButton?: (props: {
    onClick: () => void;
    showForm: boolean;
  }) => React.ReactNode;
}

export function NewClientSection({
  onClientCreated,
  renderButton,
}: NewClientSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const createClient = useMutation(api.functions.clients.createClient);

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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

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

      // Notificar al componente padre
      onClientCreated({
        id: clientId,
        name: formData.name,
        role: "",
      });

      toast.success("Cliente creado y agregado exitosamente");

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
      setShowForm(false);
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Error al crear el cliente: " + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col w-full justify-center items-end gap-2">
      {renderButton ? (
        renderButton({ onClick: () => setShowForm(!showForm), showForm })
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="h-8 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          {showForm ? "Cancelar" : "Nuevo Cliente"}
        </Button>
      )}

      {showForm && (
        <div className="p-4 border rounded-md bg-muted/30 space-y-3 w-full">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Crear Nuevo Cliente</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Nombre */}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nombre / Razón Social *</Label>
              <Input
                placeholder="Ej: Juan Pérez"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Tipo */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select
                value={formData.clientType}
                onValueChange={(value) =>
                  handleInputChange("clientType", value)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Persona Física</SelectItem>
                  <SelectItem value="company">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DNI/CUIT */}
            {formData.clientType === "individual" ? (
              <div className="space-y-1">
                <Label className="text-xs">DNI *</Label>
                <Input
                  placeholder="12345678"
                  value={formData.dni}
                  onChange={(e) => handleInputChange("dni", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">CUIT *</Label>
                <Input
                  placeholder="20-12345678-9"
                  value={formData.cuit}
                  onChange={(e) => handleInputChange("cuit", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input
                placeholder="+54 11 1234-5678"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleCreateClient}
            disabled={isCreating}
            className="w-full h-8 text-sm"
            size="sm"
          >
            {isCreating ? "Creando..." : "Crear y Agregar Cliente"}
          </Button>
        </div>
      )}
    </div>
  );
}
