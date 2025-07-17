import CaseGrid from "../components/Cases/CaseGrid";

export default function CasesPage() {
  return (
    <div className="flex flex-col gap-4 pt-20 pl-10">
      <h1 className="text-2xl font-bold">Casos</h1>
      <CaseGrid />
    </div>
  );
}
