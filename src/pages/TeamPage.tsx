import ConditionalLayout from "@/components/Layout/ConditionalLayout";
import { useLayout } from "@/context/LayoutContext";
import TeamTable from "@/components/Teams/TeamTable";
import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";

export default function TeamPage() {
  const { isInCaseContext } = useLayout();

  return (
    <ConditionalLayout>
      <div
        className={`flex flex-col gap-4 w-full min-h-screen px-10 bg-[#f7f7f7] ${isInCaseContext ? "pt-5" : "pt-20"}`}
      >
        <section className="w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold text-black">Equipos</h1>
          <CreateTeamDialog />
        </section>
        <TeamTable />
      </div>
    </ConditionalLayout>
  );
}
