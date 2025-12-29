import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, X, User, Building2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";

interface ClientFilterDialogProps {
  selectedClient: { id: Id<"clients">; name: string } | null;
  onSelectClient: (client: { id: Id<"clients">; name: string } | null) => void;
}

export default function ClientFilterDialog({
  selectedClient,
  onSelectClient,
}: ClientFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const clientsResult = useQuery(api.functions.clients.getClients, {
    paginationOpts: { numItems: 100, cursor: "0" },
    search: searchQuery.trim() || undefined,
  });

  const clients = clientsResult?.page || [];

  const handleSelectClient = (client: {
    _id: Id<"clients">;
    displayName: string;
  }) => {
    onSelectClient({ id: client._id, name: client.displayName });
    setOpen(false);
    setSearchQuery("");
  };

  const handleClearFilter = () => {
    onSelectClient(null);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">
            {selectedClient ? selectedClient.name : "Filtrar por cliente"}
          </span>
          <span className="sm:hidden">Cliente</span>
          {selectedClient && (
            <Badge variant="secondary" className="ml-1">
              1
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filtrar casos por cliente</DialogTitle>
          <DialogDescription>
            Selecciona un cliente para ver solo sus casos asociados
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, DNI, CUIT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Client */}
          {selectedClient && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {selectedClient.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="h-8 gap-1"
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          )}

          {/* Clients List */}
          <ScrollArea className="h-[400px] rounded-md border ">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchQuery
                  ? "No se encontraron clientes"
                  : "No hay clientes disponibles"}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {clients.map((client) => (
                  <button
                    key={client._id}
                    onClick={() => handleSelectClient(client)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left ${
                      selectedClient?.id === client._id
                        ? "bg-blue-50 border border-blue-200"
                        : "border border-transparent"
                    }`}
                  >
                    <div className="mt-0.5">
                      {client.naturalezaJuridica === "juridica" ? (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      ) : (
                        <User className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {client.displayName}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-500">
                        {client.dni && <span>DNI: {client.dni}</span>}
                        {client.cuit && <span>CUIT: {client.cuit}</span>}
                        {client.email && (
                          <span className="truncate">{client.email}</span>
                        )}
                      </div>
                      {client.cases && client.cases.length > 0 && (
                        <div className="mt-1 text-xs text-gray-400">
                          {client.cases.length} caso
                          {client.cases.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            <p className="text-sm text-gray-500">
              {clients.length} cliente{clients.length !== 1 ? "s" : ""}{" "}
              {searchQuery && "encontrado" + (clients.length !== 1 ? "s" : "")}
            </p>
            {selectedClient && (
              <Button variant="outline" size="sm" onClick={handleClearFilter}>
                Limpiar filtro
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
