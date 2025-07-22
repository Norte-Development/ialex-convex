import CaseGrid from "../components/Cases/CaseGrid";
import CreateCaseDialog from "../components/Cases/CreateCaseDialog";
import ConditionalLayout from "../components/Layout/ConditionalLayout";
import { useLayout } from "@/context/LayoutContext";

export default function CasesPage() {
  const { isInCaseContext } = useLayout();

  return (
    <ConditionalLayout>
      <div
        className={`flex flex-col gap-4 w-full h-full px-5 ${isInCaseContext ? "pt-5" : "pt-20"}`}
      >
        <div className="w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold">Casos</h1>
          <CreateCaseDialog />
        </div>
        <div className="w-full flex justify-start">
          <CaseGrid />
        </div>
      </div>
    </ConditionalLayout>
  );
}
