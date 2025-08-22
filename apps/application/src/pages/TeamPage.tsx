import TeamTable from "@/components/Teams/TeamTable";
import CreateTeamDialog from "@/components/Teams/CreateTeamDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function TeamPage() {
  return (
    <section
      className={`flex flex-col mt-18 gap-4 py-5 w-[70%] min-h-screen px-10 bg-white `}
    >
      <section className="w-full flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black">Equipos</h1>
        <CreateTeamDialog />
      </section>
      
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Gestión de Permisos</p>
              <p>
                Los permisos específicos de casos se gestionan desde dentro del caso.
                Aquí puedes administrar la membresía general de equipos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <TeamTable />
    </section>
  );
}
