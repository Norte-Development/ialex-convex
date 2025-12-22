import { useState } from "react";
import { useMutation } from "convex/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";
import { LocalErrorBoundary } from "../LocalErrorBoundary";
import { AlertTriangle, Building2, User } from "lucide-react";
import {
  type NaturalezaJuridica,
  type ActividadEconomica,
  type TipoPersonaJuridica,
  type TipoSociedad,
  ACTIVIDAD_ECONOMICA_LABELS,
  TIPO_PERSONA_JURIDICA_LABELS,
  TIPO_SOCIEDAD_LABELS,
  esCuitObligatorio,
  requiereAlertaLegal,
} from "../../../types/clients";

interface FormData {
  // Capa 1
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
  descripcionOtro: string;
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
  descripcionOtro: "",
  cuit: "",
  email: "",
  phone: "",
  domicilioLegal: "",
  notes: "",
};

export default function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const createClient = useMutation(api.functions.clients.createClient);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleInputChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Determinar si CUIT es obligatorio
  const cuitRequired = esCuitObligatorio(
    formData.naturalezaJuridica,
    formData.actividadEconomica,
  );

  // Alerta legal para sociedades irregulares/de hecho
  const showLegalAlert =
    formData.tipoSociedad &&
    requiereAlertaLegal(formData.tipoSociedad as TipoSociedad);

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (!formData.tipoPersonaJuridica) {
        toast.error("El tipo de persona jurídica es requerido");
        return;
      }
      if (
        formData.tipoPersonaJuridica === "sociedad" &&
        !formData.tipoSociedad
      ) {
        toast.error("El tipo de sociedad es requerido");
        return;
      }
      if (
        (formData.tipoPersonaJuridica === "otro" ||
          formData.tipoSociedad === "OTRO") &&
        !formData.descripcionOtro.trim()
      ) {
        toast.error("La descripción es requerida para tipos no listados");
        return;
      }
    }

    setIsLoading(true);

    try {
      const clientData = {
        naturalezaJuridica: formData.naturalezaJuridica,
        // Persona Humana
        nombre: formData.nombre || undefined,
        apellido: formData.apellido || undefined,
        dni: formData.dni || undefined,
        actividadEconomica:
          formData.naturalezaJuridica === "humana"
            ? formData.actividadEconomica
            : undefined,
        profesionEspecifica: formData.profesionEspecifica || undefined,
        // Persona Jurídica
        razonSocial: formData.razonSocial || undefined,
        tipoPersonaJuridica: formData.tipoPersonaJuridica || undefined,
        tipoSociedad: formData.tipoSociedad || undefined,
        descripcionOtro: formData.descripcionOtro || undefined,
        // Comunes
        cuit: formData.cuit || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        domicilioLegal: formData.domicilioLegal || undefined,
        notes: formData.notes || undefined,
      };

      const clientId = await createClient(clientData as any);
      console.log("Client created with ID:", clientId);

      tracking.clientCreated({
        clientId,
        clientType:
          formData.naturalezaJuridica === "humana" ? "individual" : "company",
      });

      setFormData(initialFormData);
      await new Promise((resolve) => setTimeout(resolve, 100));
      closeFloatingLayers();
      setOpen(false);
      toast.success("Cliente creado correctamente");
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Error al crear el cliente: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild data-tutorial="create-client">
        <Button className="gap-2 cursor-pointer text-[12px]" size="sm">
          Añadir Cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <LocalErrorBoundary resetKeys={[open]}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Complete la información según el tipo de persona (CCyCN).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Naturaleza Jurídica */}
            <div className="space-y-2">
              <Label>Naturaleza Jurídica *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleInputChange("naturalezaJuridica", "humana")
                  }
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    formData.naturalezaJuridica === "humana"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <User
                    className={`w-5 h-5 ${
                      formData.naturalezaJuridica === "humana"
                        ? "text-primary"
                        : "text-gray-400"
                    }`}
                  />
                  <div className="text-left">
                    <div className="font-medium">Persona Humana</div>
                    <div className="text-xs text-muted-foreground">
                      Art. 19 CCyCN
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleInputChange("naturalezaJuridica", "juridica")
                  }
                  className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                    formData.naturalezaJuridica === "juridica"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Building2
                    className={`w-5 h-5 ${
                      formData.naturalezaJuridica === "juridica"
                        ? "text-primary"
                        : "text-gray-400"
                    }`}
                  />
                  <div className="text-left">
                    <div className="font-medium">Persona Jurídica</div>
                    <div className="text-xs text-muted-foreground">
                      Art. 141 CCyCN
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Campos según naturaleza jurídica */}
            {formData.naturalezaJuridica === "humana" ? (
              <>
                {/* Nombre y Apellido */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      placeholder="Ej: Juan Carlos"
                      value={formData.nombre}
                      onChange={(e) =>
                        handleInputChange("nombre", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input
                      id="apellido"
                      placeholder="Ej: Pérez"
                      value={formData.apellido}
                      onChange={(e) =>
                        handleInputChange("apellido", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* DNI */}
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI *</Label>
                  <Input
                    id="dni"
                    placeholder="Ej: 12345678"
                    value={formData.dni}
                    onChange={(e) => handleInputChange("dni", e.target.value)}
                    required
                  />
                </div>

                {/* Actividad Económica */}
                <div className="space-y-2">
                  <Label>Actividad Económica *</Label>
                  <Select
                    value={formData.actividadEconomica}
                    onValueChange={(value) =>
                      handleInputChange(
                        "actividadEconomica",
                        value as ActividadEconomica,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar actividad" />
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
                  <p className="text-xs text-muted-foreground">
                    Impacta en: Defensa del consumidor, tipo de contratos,
                    responsabilidad
                  </p>
                </div>

                {/* Profesión específica (si corresponde) */}
                {formData.actividadEconomica !== "sin_actividad" && (
                  <div className="space-y-2">
                    <Label htmlFor="profesionEspecifica">
                      Profesión / Actividad específica
                    </Label>
                    <Input
                      id="profesionEspecifica"
                      placeholder={
                        formData.actividadEconomica === "profesional"
                          ? "Ej: Abogado, Médico, Contador"
                          : "Ej: Comercio minorista, Gastronomía"
                      }
                      value={formData.profesionEspecifica}
                      onChange={(e) =>
                        handleInputChange("profesionEspecifica", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Razón Social */}
                <div className="space-y-2">
                  <Label htmlFor="razonSocial">Razón Social *</Label>
                  <Input
                    id="razonSocial"
                    placeholder="Ej: ACME S.A."
                    value={formData.razonSocial}
                    onChange={(e) =>
                      handleInputChange("razonSocial", e.target.value)
                    }
                    required
                  />
                </div>

                {/* Tipo de Persona Jurídica */}
                <div className="space-y-2">
                  <Label>Tipo de Persona Jurídica *</Label>
                  <Select
                    value={formData.tipoPersonaJuridica}
                    onValueChange={(value) =>
                      handleInputChange(
                        "tipoPersonaJuridica",
                        value as TipoPersonaJuridica,
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

                {/* Tipo de Sociedad (si corresponde) */}
                {formData.tipoPersonaJuridica === "sociedad" && (
                  <div className="space-y-2">
                    <Label>Tipo de Sociedad *</Label>
                    <Select
                      value={formData.tipoSociedad}
                      onValueChange={(value) =>
                        handleInputChange("tipoSociedad", value as TipoSociedad)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo societario" />
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

                    {/* Alerta para sociedades irregulares */}
                    {showLegalAlert && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-amber-800">
                          <strong>Alerta legal:</strong> Las sociedades
                          irregulares o de hecho tienen responsabilidad
                          ilimitada y solidaria de todos los socios.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Descripción para "otro" */}
                {(formData.tipoPersonaJuridica === "otro" ||
                  formData.tipoSociedad === "OTRO") && (
                  <div className="space-y-2">
                    <Label htmlFor="descripcionOtro">Descripción *</Label>
                    <Input
                      id="descripcionOtro"
                      placeholder="Describir el tipo de entidad"
                      value={formData.descripcionOtro}
                      onChange={(e) =>
                        handleInputChange("descripcionOtro", e.target.value)
                      }
                      required
                    />
                  </div>
                )}
              </>
            )}

            {/* Campos comunes */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                Datos de Contacto
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {/* CUIT */}
                <div className="space-y-2">
                  <Label htmlFor="cuit">
                    CUIT {cuitRequired ? "*" : "(opcional)"}
                  </Label>
                  <Input
                    id="cuit"
                    placeholder="Ej: 20-12345678-9"
                    value={formData.cuit}
                    onChange={(e) => handleInputChange("cuit", e.target.value)}
                    required={cuitRequired}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ej: cliente@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="Ej: +54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>

                {/* Domicilio Legal */}
                <div className="space-y-2">
                  <Label htmlFor="domicilioLegal">Domicilio Legal</Label>
                  <Input
                    id="domicilioLegal"
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    value={formData.domicilioLegal}
                    onChange={(e) =>
                      handleInputChange("domicilioLegal", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2 mt-4">
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
                onClick={() => {
                  closeFloatingLayers();
                  setOpen(false);
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creando..." : "Crear Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </LocalErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
