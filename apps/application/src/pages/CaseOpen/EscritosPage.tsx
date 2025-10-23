import CaseLayout from "@/components/Cases/CaseLayout";
import { useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useCase } from "@/context/CaseContext";
import { useEscrito } from "@/context/EscritoContext";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CreateEscritoDialog } from "@/components/CreateEscritoDialog";
import EscritosListContainer from "@/components/Escritos/EscritosListContainer";
import EscritoDetail from "@/components/Escritos/EscritoDetail";

export default function EscritosPage() {
  const { escritoId } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const { currentCase } = useCase();
  const { setEscritoId } = useEscrito();

  const isValidEscritoId =
    escritoId && escritoId !== "undefined" && escritoId.length > 0;

  // Sync context with URL
  useEffect(() => {
    setEscritoId(escritoId || undefined);
  }, [escritoId, setEscritoId]);

  // Queries

  const escrito = useQuery(
    api.functions.documents.getEscrito,
    isValidEscritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip",
  );

  if (!escrito && !templateId) {
    return (
      <CaseLayout>
        {currentCase?._id && (
          <EscritosListContainer 
            caseId={currentCase._id} 
            pageSize={20} 
          />
        )}
        <CreateEscritoDialog setOpen={() => {}} />
      </CaseLayout>
    );
  }

  if (escrito) {
    return (
      <CaseLayout>
        <EscritoDetail
          escrito={escrito}
          templateId={templateId as Id<"modelos">}
        />
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <div>No se encontró el escrito</div>
    </CaseLayout>
  );
}
