import ClientsTable from "@/components/Clients/ClientsTable";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useMemo } from "react";
import { useCase } from "@/context/CaseContext";
import SyncNewClientDialog from "@/components/Cases/SyncNewClientDialog";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CaseLayout from "@/components/Cases/CaseLayout";

export default function CaseClientsPage() {
  const { currentCase, isLoading, error, caseId } = useCase();
  const [isSyncNewClientDialogOpen, setIsSyncNewClientDialogOpen] =
    useState(false);

  const clientsResult = useQuery(
    api.functions.cases.getClientsForCase,
    caseId ? { caseId } : "skip",
  );

  const transformedClientsResult = useMemo(() => {
    if (!clientsResult) return null;

    return {
      page: clientsResult,
      isDone: true,
      continueCursor: undefined,
    };
  }, [clientsResult]);

  if (isLoading) {
    return (
      <CaseLayout>
        <section className=" w-full h-full flex flex-col pl-5 pt-5">
          <h1 className="text-2xl font-bold">Cargando caso...</h1>
        </section>
      </CaseLayout>
    );
  }

  if (error || !currentCase) {
    return (
      <CaseLayout>
        <section className=" w-full h-full flex flex-col pl-5 pt-5">
          <h1 className="text-2xl font-bold">Error</h1>
          <p>{error || "Caso no encontrado"}</p>
        </section>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <section className=" w-full h-full flex flex-col px-5  gap-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Clientes </h1>
          <Button onClick={() => setIsSyncNewClientDialogOpen(true)}>
            <Plus size={15} />
          </Button>
        </div>
        <ClientsTable clientsResult={transformedClientsResult} />
        <SyncNewClientDialog
          open={isSyncNewClientDialogOpen}
          onOpenChange={setIsSyncNewClientDialogOpen}
        />
      </section>
    </CaseLayout>
  );
}
