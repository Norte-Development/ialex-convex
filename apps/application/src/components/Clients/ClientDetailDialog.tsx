import { useEffect, useMemo, useState } from "react";
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
import { Separator } from "../ui/separator";
import { AlertTriangle, Building2, User } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
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
  requiereAlertaLegal,
} from "../../../types/clients";

interface ClientDetailDialogProps {
  clientId: Id<"clients">;
  initialClient?: any;
  children: React.ReactNode;
}

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

export default function ClientDetailDialog({
  clientId,
  initialClient,
  children,
}: ClientDetailDialogProps) {
  const [open, setOpen] = useState(false);

  const client = useQuery(
    api.functions.clients.getClientById,
    open ? { clientId } : "skip",
  );

  const updateClient = useMutation(api.functions.clients.updateClient);
  const deleteClient = useMutation(api.functions.clients.deleteClient);

  const baseClient = useMemo(
    () => client ?? initialClient,
    [client, initialClient],
  );

  const [formData, setFormData] = useState<FormData>({
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
  });

  useEffect(() => {
    if (baseClient) {
      // Determinar naturaleza jurídica (compatibilidad con legacy)
      let naturaleza: NaturalezaJuridica = "humana";
      if (baseClient.naturalezaJuridica) {
        naturaleza = baseClient.naturalezaJuridica;
      } else if (baseClient.clientType === "company") {
        naturaleza = "juridica";
      }

      setFormData({
        naturalezaJuridica: naturaleza,
        nombre: baseClient.nombre ?? "",
        apellido: baseClient.apellido ?? "",
        dni: baseClient.dni ?? "",
        actividadEconomica: baseClient.actividadEconomica ?? "sin_actividad",
        profesionEspecifica: baseClient.profesionEspecifica ?? "",
        razonSocial: baseClient.razonSocial ?? baseClient.name ?? "",
        tipoPersonaJuridica: baseClient.tipoPersonaJuridica ?? "",
        tipoSociedad: baseClient.tipoSociedad ?? "",
        descripcionOtro: baseClient.descripcionOtro ?? "",
        cuit: baseClient.cuit ?? "",
        email: baseClient.email ?? "",
        phone: baseClient.phone ?? "",
        domicilioLegal: baseClient.domicilioLegal ?? baseClient.address ?? "",
        notes: baseClient.notes ?? "",
      });
    }
  }, [baseClient]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Determinar si CUIT es obligatorio
  const cuitRequired = esCuitObligatorio(
    formData.naturalezaJuridica,
    formData.actividadEconomica,
  );

  // Alerta legal para sociedades irregulares/de hecho
  const showLegalAlert =
    formData.tipoSociedad &&
    requiereAlertaLegal(formData.tipoSociedad as TipoSociedad);

  // Prevent dialog closing while submitting
  const handleOpenChange = (newOpen: boolean) => {
    if (!saving && !deleting) setOpen(newOpen);
  };

  const handleChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
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

    setSaving(true);
    try {
      await updateClient({
        clientId: clientId,
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
      } as any);
      toast.success("Cliente actualizado correctamente");
      await new Promise((resolve) => setTimeout(resolve, 100));
      closeFloatingLayers();
      setOpen(false);
    } catch (e) {
      toast.error("Error al guardar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm("¿Eliminar este cliente? Se desactivarán sus vínculos a casos.")
    )
      return;
    setDeleting(true);
    try {
      await deleteClient({ clientId: clientId });
      await new Promise((resolve) => setTimeout(resolve, 100));
      closeFloatingLayers();
      setOpen(false);
      toast.success("Cliente eliminado correctamente");
    } catch (e) {
      toast.error("Error al eliminar: " + (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  // Detectar si es cliente legacy (tiene name pero no naturalezaJuridica)
  const isLegacyClient =
    baseClient && !baseClient.naturalezaJuridica && baseClient.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente</DialogTitle>
          <DialogDescription>
            Ver y editar la información del cliente.
          </DialogDescription>
        </DialogHeader>

        {!baseClient ? (
          <div className="text-sm">Cargando...</div>
        ) : (
          <div className="space-y-6">
            {/* Banner para clientes legacy */}
            {isLegacyClient && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800">
                  <strong>Cliente legacy:</strong> Este cliente usa el formato
                  anterior. Al guardar, se actualizará al nuevo modelo jurídico.
                </div>
              </div>
            )}

            {/* Naturaleza Jurídica (solo lectura) */}
            <div className="space-y-2">
              <Label>Naturaleza Jurídica</Label>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                {formData.naturalezaJuridica === "humana" ? (
                  <>
                    <User className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">Persona Humana</span>
                    <span className="text-xs text-muted-foreground">
                      (Art. 19 CCyCN)
                    </span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">Persona Jurídica</span>
                    <span className="text-xs text-muted-foreground">
                      (Art. 141 CCyCN)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Campos según naturaleza jurídica */}
            {formData.naturalezaJuridica === "humana" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      value={formData.nombre}
                      onChange={(e) => handleChange("nombre", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido *</Label>
                    <Input
                      value={formData.apellido}
                      onChange={(e) => handleChange("apellido", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>DNI *</Label>
                  <Input
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

                {formData.actividadEconomica !== "sin_actividad" && (
                  <div className="space-y-2">
                    <Label>Profesión / Actividad específica</Label>
                    <Input
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
                <div className="space-y-2">
                  <Label>Razón Social *</Label>
                  <Input
                    value={formData.razonSocial}
                    onChange={(e) =>
                      handleChange("razonSocial", e.target.value)
                    }
                  />
                </div>

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

                    {showLegalAlert && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-amber-800">
                          <strong>Alerta legal:</strong> Responsabilidad
                          ilimitada y solidaria de todos los socios.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(formData.tipoPersonaJuridica === "otro" ||
                  formData.tipoSociedad === "OTRO") && (
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={formData.descripcionOtro}
                      onChange={(e) =>
                        handleChange("descripcionOtro", e.target.value)
                      }
                    />
                  </div>
                )}
              </>
            )}

            <Separator />

            {/* Datos de contacto */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                Datos de Contacto
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CUIT {cuitRequired ? "*" : "(opcional)"}</Label>
                  <Input
                    value={formData.cuit}
                    onChange={(e) => handleChange("cuit", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domicilio Legal</Label>
                  <Input
                    value={formData.domicilioLegal}
                    onChange={(e) =>
                      handleChange("domicilioLegal", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label>Notas</Label>
                <Textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Casos relacionados */}
            <div>
              <div className="text-sm font-medium mb-2">Casos relacionados</div>
              {baseClient.cases && baseClient.cases.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {baseClient.cases.map((c: any) => (
                    <div
                      key={c.relationId}
                      className="flex items-center justify-between border rounded p-2 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {c.case?.title ?? "Caso"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Rol: {c.role || "Rol no disponible"}
                        </span>
                      </div>
                      {c.case?._id && (
                        <Link
                          to={`/caso/${c.case._id}`}
                          className="text-xs underline"
                        >
                          Ver caso
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No hay casos vinculados.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-2 rounded border border-destructive/40 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div className="text-xs">
                Eliminar el cliente lo desactivará y removerá sus vínculos
                activos a casos.
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving || deleting}
            className="text-xs cursor-pointer"
          >
            Cerrar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-xs cursor-pointer"
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || deleting}
            className="text-xs cursor-pointer"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
