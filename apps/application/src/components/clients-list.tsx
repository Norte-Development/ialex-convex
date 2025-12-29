import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Building2, User } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Loader } from "@/components/ai-elements/loader";

export function ClientsList() {
  const navigate = useNavigate();

  // Fetch recent clients
  const clientsResult = useQuery(api.functions.clients.getClients, {
    paginationOpts: { numItems: 6, cursor: null },
  });

  const clients = clientsResult?.page || [];
  const isLoading = clientsResult === undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#130261]">
            Clientes Recientes
          </h2>
        </div>
        <button
          onClick={() => navigate("/clientes")}
          className="text-sm text-[#130261] hover:underline"
        >
          Ver todos
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader size={24} />
        </div>
      ) : clients.length > 0 ? (
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client._id}
              className="bg-white rounded-lg border border-[#130261]/10 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#130261]/10 flex items-center justify-center shrink-0">
                  {client.naturalezaJuridica === "juridica" ? (
                    <Building2 size={16} className="text-[#130261]" />
                  ) : (
                    <User size={16} className="text-[#130261]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-[#130261] truncate">
                    {client.displayName}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {client.naturalezaJuridica === "juridica"
                      ? "P. Jurídica"
                      : "P. Humana"}
                    {client.dni && ` • DNI: ${client.dni}`}
                    {client.cuit && ` • CUIT: ${client.cuit}`}
                  </p>
                  {client.cases && client.cases.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {client.cases.length} caso
                      {client.cases.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#130261]/10 p-6 text-center">
          <UserPlus size={32} className="text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-3">
            No hay clientes registrados
          </p>
          <button
            onClick={() => navigate("/clientes")}
            className="text-sm text-[#130261] hover:underline font-medium"
          >
            Crear primer cliente
          </button>
        </div>
      )}
    </div>
  );
}
