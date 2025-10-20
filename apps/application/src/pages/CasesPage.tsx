import CreateCaseDialog from "../components/Cases/CreateCaseDialog";
import { useCase } from "@/context/CaseContext";
import { CaseProvider } from "@/context/CaseContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Case } from "types/cases";
import CaseTable from "@/components/Cases/CaseTable";
import { useBillingData, UsageMeter } from "@/components/Billing";

function CasesContent() {
  const { currentCase } = useCase();
  const cases = useQuery(api.functions.cases.getCases, {}) as
    | Case[]
    | undefined;

  const { usage, limits } = useBillingData({});

  return (
    <div
      className={`flex flex-col gap-4 w-full  min-h-screen px-5 ${currentCase ? "pt-5" : "pt-20"}`}
    >
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold">Casos</h1>
        <div className="flex items-center gap-4">
          {usage && limits && (
            <div className="w-64">
              <UsageMeter
                used={usage.casesCount}
                limit={limits.cases}
                label="Casos"
                showPercentage={false}
              />
            </div>
          )}
          <CreateCaseDialog />
        </div>
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
