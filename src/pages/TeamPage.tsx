import TeamTable from "@/components/Teams/TeamTable";
import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";

export default function TeamPage() {
  return (
    <section
      className={`flex flex-col mt-18 gap-4 py-5 w-[70%] min-h-screen px-10 bg-white `}
    >
      <section className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black">Equipos</h1>
        <CreateTeamDialog />
      </section>
      <TeamTable />
    </section>
  );
}
