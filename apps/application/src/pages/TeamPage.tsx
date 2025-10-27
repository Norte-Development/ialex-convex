import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";
import TeamsContainer from "@/components/Teams/TeamsContainer";
import { Users } from "lucide-react";

export default function TeamPage() {
  return (
    <section
      className={`flex flex-col mt-18 gap-4 py-5 w-[75%] min-h-screen px-10 bg-white`}
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
      <div className="flex-1 flex flex-col">
        <TeamsContainer pageSize={20} />
      </div>
    </section>
  );
}
