import CaseGrid from "../components/Cases/CaseGrid";
import CreateCaseDialog from "../components/Cases/CreateCaseDialog";
import { useCase } from "@/context/CaseContext";
import { CaseProvider } from "@/context/CaseContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Case } from "types/cases";
import CaseTable from "@/components/Cases/CaseTable";

function CasesContent() {
  const { currentCase } = useCase();
  const cases = useQuery(api.functions.cases.getCases, {}) as
    | Case[]
    | undefined;

  return (
    <div
      className={`flex flex-col gap-4 w-full h-full px-5 ${currentCase ? "pt-5" : "pt-20"}`}
    >
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold">Casos</h1>
        <CreateCaseDialog />
      </div>
      <div className="w-full flex justify-start">
        <CaseTable cases={cases} />
      </div>
    </div>
  );
}

export default function CasesPage() {
  return (
    <CaseProvider>
      <CasesContent />
    </CaseProvider>
  );
}
