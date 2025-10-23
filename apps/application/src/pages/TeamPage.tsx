import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";
import TeamCard from "@/components/Teams/TeamCard";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Users } from "lucide-react";

export default function TeamPage() {
  const teams = useQuery(api.functions.teams.getTeams, {});

  if (!teams) return <div>Cargando...</div>;

  return (
    <section
      className={`flex flex-col mt-18 gap-4 py-5 w-[75%]  min-h-screen px-10 bg-white `}
    >
      <section className="w-full flex justify-between items-center">
        <div className="space-y-1 flex flex-col ">
          <div className="flex items-center gap-2">
            <Users size={25} className="text-primary" />
            <h1 className="text-2xl font-bold">Equipos</h1>
          </div>
          <p className="text-sm text-gray-600">
            Gestiona todos los equipos de trabajo.
          </p>
        </div>
        <CreateTeamDialog />
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
        {teams.map((team) => (
          <TeamCard key={team._id} team={team} />
        ))}
      </div>
    </section>
  );
}
