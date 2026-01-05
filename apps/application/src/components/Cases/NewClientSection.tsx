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
import { Plus, X, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import {
  type NaturalezaJuridica,
  type ActividadEconomica,
  ACTIVIDAD_ECONOMICA_LABELS,
  esCuitObligatorio,
} from "../../../types/clients";

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

interface FormData {
  naturalezaJuridica: NaturalezaJuridica;
  // Persona Humana
  nombre: string;
  apellido: string;
  dni: string;
  actividadEconomica: ActividadEconomica;
  // Persona Jurídica
  razonSocial: string;
  // Comunes
  cuit: string;
  email: string;
  phone: string;
}

const initialFormData: FormData = {
  naturalezaJuridica: "humana",
  nombre: "",
  apellido: "",
  dni: "",
  actividadEconomica: "sin_actividad",
  razonSocial: "",
  cuit: "",
  email: "",
  phone: "",
};

export function NewClientSection({
  onClientCreated,
  renderButton,
}: NewClientSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const createClient = useMutation(api.functions.clients.createClient);

  const [formData, setFormData] = useState<FormData>(initialFormData);

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

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
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
      const clientData =
        formData.naturalezaJuridica === "humana"
          ? {
              naturalezaJuridica: "humana" as const,
              nombre: formData.nombre,
              apellido: formData.apellido,
              dni: formData.dni,
              actividadEconomica: formData.actividadEconomica,
              cuit: formData.cuit || undefined,
              email: formData.email || undefined,
              phone: formData.phone || undefined,
            }
          : {
              naturalezaJuridica: "juridica" as const,
              razonSocial: formData.razonSocial,
              cuit: formData.cuit,
              email: formData.email || undefined,
              phone: formData.phone || undefined,
            };

      const clientId = await createClient(clientData);

      // Track client creation
      tracking.clientCreated({
        clientId,
        clientType:
          formData.naturalezaJuridica === "humana" ? "individual" : "company",
      });

      // Calcular displayName para el callback
      const displayName =
        formData.naturalezaJuridica === "humana"
          ? `${formData.apellido}, ${formData.nombre}`
          : formData.razonSocial;

      // Notificar al componente padre
      onClientCreated({
        id: clientId,
        name: displayName,
        role: "",
      });

      toast.success("Cliente creado y agregado exitosamente");

      // Reset form
      setFormData(initialFormData);
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

          {/* Selector de Naturaleza Jurídica */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={
                formData.naturalezaJuridica === "humana" ? "default" : "outline"
              }
              size="sm"
              onClick={() => handleChange("naturalezaJuridica", "humana")}
              className="h-9 text-xs gap-1"
            >
              <User className="h-3 w-3" />
              Persona Humana
            </Button>
            <Button
              type="button"
              variant={
                formData.naturalezaJuridica === "juridica"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleChange("naturalezaJuridica", "juridica")}
              className="h-9 text-xs gap-1"
            >
              <Building2 className="h-3 w-3" />
              Persona Jurídica
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {formData.naturalezaJuridica === "humana" ? (
              <>
                {/* Nombre */}
                <div className="space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input
                    placeholder="Juan"
                    value={formData.nombre}
                    onChange={(e) => handleChange("nombre", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Apellido */}
                <div className="space-y-1">
                  <Label className="text-xs">Apellido *</Label>
                  <Input
                    placeholder="Pérez"
                    value={formData.apellido}
                    onChange={(e) => handleChange("apellido", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* DNI */}
                <div className="space-y-1">
                  <Label className="text-xs">DNI *</Label>
                  <Input
                    placeholder="12345678"
                    value={formData.dni}
                    onChange={(e) => handleChange("dni", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Actividad Económica */}
                <div className="space-y-1">
                  <Label className="text-xs">Actividad</Label>
                  <Select
                    value={formData.actividadEconomica}
                    onValueChange={(v) =>
                      handleChange(
                        "actividadEconomica",
                        v as ActividadEconomica,
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
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

                {/* CUIT (condicional) */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    CUIT {cuitRequired ? "*" : "(opc.)"}
                  </Label>
                  <Input
                    placeholder="20-12345678-9"
                    value={formData.cuit}
                    onChange={(e) => handleChange("cuit", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Razón Social */}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Razón Social *</Label>
                  <Input
                    placeholder="Empresa ABC S.A."
                    value={formData.razonSocial}
                    onChange={(e) =>
                      handleChange("razonSocial", e.target.value)
                    }
                    className="h-8 text-sm"
                  />
                </div>

                {/* CUIT */}
                <div className="space-y-1">
                  <Label className="text-xs">CUIT *</Label>
                  <Input
                    placeholder="30-12345678-9"
                    value={formData.cuit}
                    onChange={(e) => handleChange("cuit", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <Label className="text-xs">Teléfono</Label>
              <Input
                placeholder="+54 11 1234-5678"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
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
