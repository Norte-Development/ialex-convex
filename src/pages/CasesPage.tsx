import CaseGrid from "../components/Cases/CaseGrid";
import CreateCaseDialog from "../components/Cases/CreateCaseDialog";

export default function CasesPage() {
  return (
    <div className="flex flex-col gap-4 pt-20 pl-10">
      <div className="flex justify-between items-center px-10">
        <h1 className="text-2xl font-bold">Casos</h1>
        <CreateCaseDialog />
      </div>
      <CaseGrid />
    </div>
  );
}
