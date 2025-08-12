import { Input } from "@/components/ui/input";
import { useState } from "react";
import ClientsTable from "@/components/Clients/ClientsTable";
import CreateClientDialog from "@/components/Clients/CreateClientDialog";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function ClientsPage() {
  const [search, setSearch] = useState("");

  const clientsResult = useQuery(api.functions.clients.getClients, {
    search,
  });

  return (
    <div
      className={`flex flex-col gap-4 w-[70%] bg-white h-full pt-20 min-h-screen  px-10`}
    >
      <div className="w-full  flex  justify-between items-center">
        <Input
          onChange={(e) => setSearch(e.target.value)}
          className="p-1 text-sm h-6 bg-white w-[60%] placeholder:text-[12px]"
          placeholder="Buscar cliente..."
        />
        <CreateClientDialog />
      </div>

      <div className="w-full   flex justify-start  rounded-lg ">
        <ClientsTable clientsResult={clientsResult} />
      </div>
    </div>
  );
}
