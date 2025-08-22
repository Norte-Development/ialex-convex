import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X } from "lucide-react";

interface SyncNewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientWithRole {
  _id: string;
  name: string;
  email?: string;
  dni?: string;
  cuit?: string;
  clientType: "individual" | "company";
  role: string;
}

const ROLES = [
  "Demandante",
  "Demandado",
  "Testigo",
  "Representante Legal",
  "Tercero Interesado",
  "Otro",
];

export default function SyncNewClientDialog({
  open,
  onOpenChange,
}: SyncNewClientDialogProps) {
  const { caseId } = useCase();
  const [search, setSearch] = useState("");
  const [selectedClients, setSelectedClients] = useState<ClientWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Obtener todos los clientes
  const allClientsResult = useQuery(api.functions.clients.getClients, {
    search,
  });

  // Obtener clientes ya vinculados al caso
  const linkedClientsResult = useQuery(
    api.functions.cases.getClientsForCase,
    caseId ? { caseId } : "skip",
  );

  // Mutation para vincular cliente al caso
  const addClientToCase = useMutation(api.functions.cases.addClientToCase);

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

  const handleClientSelect = (client: any, checked: boolean) => {
    if (checked) {
      setSelectedClients((prev) => [
        ...prev,
        { ...client, role: "Demandante" },
      ]);
    } else {
      setSelectedClients((prev) => prev.filter((c) => c._id !== client._id));
    }
  };

  const handleRoleChange = (clientId: string, role: string) => {
    setSelectedClients((prev) =>
      prev.map((client) =>
        client._id === clientId ? { ...client, role } : client,
      ),
    );
  };

  const handleRemoveClient = (clientId: string) => {
    setSelectedClients((prev) => prev.filter((c) => c._id !== clientId));
  };

  const handleSubmit = async () => {
    if (!caseId || selectedClients.length === 0) return;

    setIsLoading(true);
    try {
      // Vincular todos los clientes seleccionados
      await Promise.all(
        selectedClients.map((client) =>
          addClientToCase({
            clientId: client._id as any,
            caseId,
            role: client.role,
          }),
        ),
      );

      // Limpiar y cerrar
      setSelectedClients([]);
      setSearch("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error vinculando clientes:", error);
      alert("Error al vincular clientes: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const isClientSelected = (clientId: string) => {
    return selectedClients.some((c) => c._id === clientId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={20} />
            Vincular Clientes al Caso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
            <Input
              placeholder="Buscar clientes disponibles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Clientes seleccionados */}
          {selectedClients.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Clientes seleccionados:
              </Label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {selectedClients.map((client) => (
                  <div
                    key={client._id}
                    className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg"
                  >
                    <Badge variant="secondary">{client.name}</Badge>
                    <Select
                      value={client.role}
                      onValueChange={(role) =>
                        handleRoleChange(client._id, role)
                      }
                    >
                      <SelectTrigger className="w-32 h-6 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem
                            key={role}
                            value={role}
                            className="text-xs"
                          >
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveClient(client._id)}
                      className="h-6 w-6 p-0"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de clientes disponibles */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Clientes disponibles:</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {!allClientsResult ? (
                <div className="p-4 text-center text-gray-500">
                  Cargando clientes...
                </div>
              ) : availableClients.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {search
                    ? "No se encontraron clientes"
                    : "Todos los clientes están vinculados"}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {availableClients.map((client: any) => (
                    <div
                      key={client._id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded"
                    >
                      <Checkbox
                        checked={isClientSelected(client._id)}
                        onCheckedChange={(checked) =>
                          handleClientSelect(client, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{client.name}</div>
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

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedClients.length === 0 || isLoading}
            >
              {isLoading
                ? "Vinculando..."
                : `Vincular ${selectedClients.length} cliente(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
