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
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import { closeFloatingLayers } from "@/lib/closeFloatingLayers";

export default function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast("El nombre es requerido");
      return;
    }

    // Validación según tipo de cliente
    if (formData.clientType === "individual" && !formData.dni.trim()) {
      toast("El DNI es requerido para personas físicas");
      return;
    }

    if (formData.clientType === "company" && !formData.cuit.trim()) {
      toast("El CUIT es requerido para empresas");
      return;
    }

    setIsLoading(true);

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
      console.log("Client created with ID:", clientId);

      // Track client creation
      tracking.clientCreated({
        clientId,
        clientType: formData.clientType,
      });

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
      // Small delay to avoid portal teardown races before closing dialog
      await new Promise((resolve) => setTimeout(resolve, 100));
      closeFloatingLayers();
      setOpen(false);
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

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Cliente</DialogTitle>
          <DialogDescription>
            Complete la información para crear un nuevo cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                    onChange={(e) => handleInputChange("dni", e.target.value)}
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
                    onChange={(e) => handleInputChange("cuit", e.target.value)}
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
                  onChange={(e) => handleInputChange("email", e.target.value)}
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
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                />
              </div>
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
      </DialogContent>
    </Dialog>
  );
}
