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
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface ClientDetailDialogProps {
  clientId: Id<"clients">;
  initialClient?: any;
  children: React.ReactNode;
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

  useEffect(() => {
    if (baseClient) {
      setFormData({
        name: baseClient.name ?? "",
        email: baseClient.email ?? "",
        phone: baseClient.phone ?? "",
        dni: baseClient.dni ?? "",
        cuit: baseClient.cuit ?? "",
        address: baseClient.address ?? "",
        clientType: baseClient.clientType ?? "individual",
        notes: baseClient.notes ?? "",
      });
    }
  }, [baseClient]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast("El nombre es requerido");
      return;
    }
    if (formData.clientType === "individual" && !formData.dni.trim()) {
      toast("El DNI es requerido para personas físicas");
      return;
    }
    if (formData.clientType === "company" && !formData.cuit.trim()) {
      toast("El CUIT es requerido para empresas");
      return;
    }
    setSaving(true);
    try {
      await updateClient({
        clientId: clientId,
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        dni:
          formData.clientType === "individual"
            ? formData.dni || undefined
            : undefined,
        cuit:
          formData.clientType === "company"
            ? formData.cuit || undefined
            : undefined,
        address: formData.address || undefined,
        clientType: formData.clientType,
        notes: formData.notes || undefined,
      });
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
      setOpen(false);
      toast.success("Cliente eliminado correctamente");
    } catch (e) {
      toast.error("Error al eliminar: " + (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente</DialogTitle>
          <DialogDescription>
            Ver y editar la información del cliente. También puedes ver sus
            casos relacionados.
          </DialogDescription>
        </DialogHeader>

        {!baseClient ? (
          <div className="text-sm">Cargando...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Nombre Completo / Razón Social *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Cliente *</Label>
                <Select
                  value={formData.clientType}
                  onValueChange={(v) => handleChange("clientType", v)}
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

              <div className="grid grid-cols-2 gap-4">
                {formData.clientType === "individual" ? (
                  <div className="space-y-2">
                    <Label>DNI *</Label>
                    <Input
                      value={formData.dni}
                      onChange={(e) => handleChange("dni", e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>CUIT *</Label>
                    <Input
                      value={formData.cuit}
                      onChange={(e) => handleChange("cuit", e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                />
              </div>
            </div>

            <Separator />

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
