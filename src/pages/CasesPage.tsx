import CaseGrid from "../components/Cases/CaseGrid";
import CreateCaseDialog from "../components/Cases/CreateCaseDialog";

export default function CasesPage() {
  return (
    <div className={`flex flex-col gap-4 w-full h-full px-5 `}>
      <div className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold">Casos</h1>
        <CreateCaseDialog />
      </div>
      <div className="w-full flex justify-start">
        <CaseGrid />
      </div>
    </div>
  );
}
