import TeamTable from "@/components/Teams/TeamTable";
import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";

export default function TeamPage() {
  return (
    <div
      className={`flex flex-col pt-20 gap-4 w-full h-full px-10 bg-[#f7f7f7] `}
    >
      <section className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black">Equipos</h1>
        <CreateTeamDialog />
      </section>
      <TeamTable />
    </div>
  );
}
