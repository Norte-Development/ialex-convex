import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";
import { Input } from "@/components/ui/input";
import TeamCard from "@/components/Teams/TeamCard";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import UserTableInCases from "@/components/users/UsersTableInCases";
import { Badge } from "@/components/ui/badge";

export default function TeamPage() {
  const teams = useQuery(api.functions.teams.getTeams, {});
  const cases = useQuery(api.functions.cases.getCases, {});

  if (!teams || !cases) return <div>Cargando...</div>;

  return (
    <section
      className={`flex flex-col mt-18 gap-4 py-5 w-full  min-h-screen px-10 bg-white `}
    >
      <section className="w-full flex justify-between items-center">
        <Input
          type="text"
          placeholder="Buscar equipos"
          className="w-1/2 border border-[#C2C2C2] rounded-full"
        />
        <CreateTeamDialog />
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
        {teams.map((team) => (
          <TeamCard key={team._id} team={team} />
        ))}
      </div>
      {cases.map((caseItem) => (
        <>
          <h2 key={caseItem._id} className=" font-semibold mb-1">
            Caso:
            <Badge variant="outline" className="ml-2">
              {caseItem.title}
            </Badge>
          </h2>
          <UserTableInCases key={caseItem._id} caseId={caseItem._id} />
        </>
      ))}
    </section>
  );
}
