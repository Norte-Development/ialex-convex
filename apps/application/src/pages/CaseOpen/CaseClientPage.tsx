import ClientsTable from "@/components/Clients/ClientsTable";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { useCase } from "@/context/CaseContext";
import SyncNewClientDialog from "@/components/Cases/SyncNewClientDialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CaseLayout from "@/components/Cases/CaseLayout";
import { usePermissions } from "@/context/CasePermissionsContext";
import { PermissionToasts } from "@/lib/permissionToasts";

export default function CaseClientsPage() {
  const { currentCase, isLoading, error, caseId } = useCase();
  const { can } = usePermissions();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [isSyncNewClientDialogOpen, setIsSyncNewClientDialogOpen] =
    useState(false);

  const handleAddClient = () => {
    if (!can.clients.write) {
      PermissionToasts.clients.write();
      return;
    }
    setIsSyncNewClientDialogOpen(true);
  };

  const clientsResult = useQuery(
    api.functions.cases.getClientsForCasePaginated,
    caseId
      ? {
          caseId,
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [caseId]);

  const transformedClientsResult = useMemo(
    () => clientsResult ?? null,
    [clientsResult],
  );

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
          <Button onClick={handleAddClient}>
            <Plus size={15} />
          </Button>
        </div>
        <ClientsTable
          clientsResult={transformedClientsResult}
          caseId={caseId!}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
        <SyncNewClientDialog
          open={isSyncNewClientDialogOpen}
          onOpenChange={setIsSyncNewClientDialogOpen}
        />
      </section>
    </CaseLayout>
  );
}
