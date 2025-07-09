import CaseCard from "../components/Cases/CaseCard";

export default function CasesPage() {
  return (
    <div className="flex flex-col gap-4 pt-20">
      <h1 className="text-2xl font-bold">Casos</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 ">
        <CaseCard title="Case 1" client="Client 1" status="completado" />
        <CaseCard title="Case 2" client="Client 2" status="en progreso" />
        <CaseCard title="Case 3" client="Client 3" status="pendiente" />
      </div>
    </div>
  );
}
