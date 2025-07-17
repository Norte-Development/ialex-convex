import CaseCard from "./CaseCard";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";
import { Case } from "../../../types/cases";

export default function CaseGrid() {
  const cases = useQuery(api.functions.cases.getCases, {}) as
    | Case[]
    | undefined;

  const isLoading = cases === undefined;

  if (isLoading) {
    return <div>Cargando casos...</div>;
  }

  if (cases && cases.length === 0) {
    return <div>No hay casos disponibles</div>;
  }
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-y-auto h-[calc(100vh-200px)] ">
      {cases?.map((caseItem) => (
        <CaseCard
          key={caseItem._id}
          title={caseItem.title}
          client={caseItem.client}
          status={caseItem.status}
        />
      ))}
    </div>
  );
}
